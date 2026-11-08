import { Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { DAILY_NOTE_PAGE_REGEX } from "roamjs-components/date/constants";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import type { OnloadArgs } from "roamjs-components/types/native";
import { getCoords } from "./utils/dom";
import getTriggerSelection from "./utils/getTriggerSelection";
import {
  getVisibleCustomWorkflows,
  predefinedWorkflows,
  PREDEFINED_REGEX,
  sbBomb,
} from "./utils/core";
import fuzzy from "fuzzy";

type Props = {
  textarea: HTMLTextAreaElement;
  trigger: string;
  triggerStart: number;
  initialFilter: string;
  isCustomOnly: boolean;
  extensionAPI: OnloadArgs["extensionAPI"];
};

// Roam may not have persisted the latest textarea input when a workflow is selected.
const waitForBlock = async ({
  uid,
  text,
  closingEditorId,
  signal,
}: {
  uid: string;
  text: string;
  closingEditorId?: string;
  signal: AbortSignal;
}): Promise<boolean> => {
  const deadline = Date.now() + 3000;
  while (!signal.aborted && Date.now() < deadline) {
    const editorStillOpen =
      closingEditorId &&
      document.getElementById(closingEditorId) instanceof HTMLTextAreaElement;
    if (!editorStillOpen && getTextByBlockUid(uid) === text) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
};

const SmartblocksMenu = ({
  onClose,
  textarea,
  trigger,
  triggerStart,
  initialFilter,
  isCustomOnly,
  extensionAPI,
}: { onClose: () => void } & Props) => {
  const { ["block-uid"]: blockUid, ["window-id"]: windowId } = useMemo(
    () =>
      window.roamAlphaAPI.ui.getFocusedBlock() || {
        "block-uid": "",
        "window-id": "",
      },
    []
  );
  const menuRef = useRef<HTMLUListElement>(null);
  const pendingSelection = useRef<AbortController>();
  useEffect(() => () => pendingSelection.current?.abort(), []);
  const [filter, setFilter] = useState(initialFilter);
  const initialWorkflows = useMemo(() => {
    return getVisibleCustomWorkflows()
      .sort(({ name: a }, { name: b }) => a.localeCompare(b))
      .concat(isCustomOnly ? [] : predefinedWorkflows);
  }, []);
  const workflows = useMemo(
    () =>
      (filter
        ? fuzzy
            .filter(filter, initialWorkflows, {
              extract: (s) => s.name,
              pre: "<b>",
              post: "</b>",
            })
            .map((r) => ({ ...r.original, displayName: r.string }))
        : initialWorkflows.map((r) => ({ ...r, displayName: r.name }))
      ).slice(0, 10),
    [filter, initialWorkflows]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const getCurrentTextarea = useCallback(() => {
    const editor = document.getElementById(textarea.id);
    return editor instanceof HTMLTextAreaElement ? editor : undefined;
  }, [textarea]);
  const onSelect = useCallback(
    (index: number, event?: KeyboardEvent) => {
      if (!menuRef.current) return;
      const currentTextarea = getCurrentTextarea();
      if (!currentTextarea) return onClose();
      const selection = getTriggerSelection({
        text: currentTextarea.value,
        selectionStart: currentTextarea.selectionStart,
        trigger,
        triggerStart,
      });
      if (!selection) return onClose();
      event?.stopPropagation();
      event?.preventDefault();
      const item =
        menuRef.current.children[index]?.querySelector(".bp3-menu-item");
      const srcName = item?.getAttribute("data-name");
      const srcUid = item?.getAttribute("data-uid");
      if (!srcName || !srcUid || pendingSelection.current) return;
      const controller = new AbortController();
      pendingSelection.current = controller;
      // On click, capture the edit first, then wait for Roam to close the editor.
      const closingEditorId = !event ? currentTextarea.id : undefined;
      if (closingEditorId) currentTextarea.blur();
      waitForBlock({
        uid: blockUid,
        text: selection.text,
        closingEditorId,
        signal: controller.signal,
      }).then((saved) => {
        if (controller.signal.aborted) return;
        pendingSelection.current = undefined;
        onClose();
        if (!saved) return;
        setTimeout(() => {
          const liveEditor = getCurrentTextarea();
          if (liveEditor && liveEditor.value !== selection.text) return;
          sbBomb({
            srcUid,
            target: {
              uid: blockUid,
              originalText: selection.text,
              start: selection.start,
              end: selection.end,
              windowId,
            },
            mutableCursor: !srcName.includes("<%NOCURSOR%>"),
          });
        }, 10);
      });
    },
    [menuRef, blockUid, getCurrentTextarea, onClose, trigger, triggerStart]
  );
  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (!menuRef.current) return;
      const isDown =
        e.key === "ArrowDown" ||
        (e.ctrlKey && (e.key === "n" || e.key === "j"));
      const isUp =
        e.key === "ArrowUp" ||
        (e.ctrlKey && (e.key === "p" || e.key === "k"));
      if (isDown) {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        const count = menuRef.current.childElementCount;
        setActiveIndex((index + 1) % count);
        e.stopPropagation();
        e.preventDefault();
      } else if (isUp) {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        const count = menuRef.current.childElementCount;
        setActiveIndex((index - 1 + count) % count);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key == "ArrowLeft" || e.key === "ArrowRight") {
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === "Enter") {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        onSelect(index, e);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose, onSelect]
  );
  useEffect(() => {
    const listeningEl = !!textarea.closest(".rm-reference-item")
      ? textarea.parentElement // Roam rerenders a new textarea in linked references on every keypress
      : textarea;
    const inputListener = (event: Event) => {
      const editor = event.target;
      if (!(editor instanceof HTMLTextAreaElement) || editor.id !== textarea.id)
        return;
      const selection = getTriggerSelection({
        text: editor.value,
        selectionStart: editor.selectionStart,
        trigger,
        triggerStart,
      });
      if (!selection) return onClose();
      setFilter(selection.filter);
      setActiveIndex(0);
    };
    listeningEl?.addEventListener("keydown", keydownListener);
    listeningEl?.addEventListener("input", inputListener);
    return () => {
      listeningEl?.removeEventListener("keydown", keydownListener);
      listeningEl?.removeEventListener("input", inputListener);
    };
  }, [keydownListener, onClose, textarea, trigger, triggerStart]);
  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      canEscapeKeyClose
      minimal
      target={<span />}
      position={Position.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: false },
        preventOverflow: { enabled: false },
      }}
      autoFocus={false}
      content={
        <Menu
          ulRef={menuRef}
          data-active-index={activeIndex}
          className={"roamjs-smartblock-menu"}
        >
          {workflows.length ? (
            workflows.map((wf, i) => {
              return (
                <MenuItem
                  key={wf.uid}
                  data-uid={wf.uid}
                  data-name={wf.name}
                  text={
                    <>
                      <img
                        src={
                          PREDEFINED_REGEX.test(wf.uid)
                            ? "https://raw.githubusercontent.com/RoamJS/smartblocks/main/src/img/gear.png"
                            : "https://raw.githubusercontent.com/RoamJS/smartblocks/main/src/img/lego3blocks.png"
                        }
                        alt={""}
                        width={15}
                        style={{ marginRight: 4 }}
                      />
                      {wf.displayName
                        .split(/<b>(.*?)<\/b>/)
                        .map((part, i) =>
                          i % 2 === 1 ? (
                            <b key={i}>{part}</b>
                          ) : (
                            <span key={i}>{part}</span>
                          )
                        )}
                    </>
                  }
                  active={i === activeIndex}
                  shouldDismissPopover={false}
                  onMouseEnter={() => setActiveIndex(i)}
                  // Take the editor snapshot in onClick before letting Roam blur it.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(i)}
                />
              );
            })
          ) : (
            <MenuItem
              text={
                <span style={{ opacity: 0.75 }}>
                  <i>No Workflows Found</i>
                </span>
              }
              active={false}
              disabled={true}
            />
          )}
        </Menu>
      }
    />
  );
};

export const render = (props: Props & { onClose: () => void }) => {
  const parent = document.createElement("span");
  const coords = getCoords(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement?.insertBefore(parent, props.textarea);
  ReactDOM.render(
    <SmartblocksMenu
      {...props}
      onClose={() => {
        props.onClose();
        ReactDOM.unmountComponentAtNode(parent);
        parent.remove();
      }}
    />,
    parent
  );
};

export default SmartblocksMenu;
