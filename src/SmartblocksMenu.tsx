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
import {
  getVisibleCustomWorkflows,
  predefinedWorkflows,
  PREDEFINED_REGEX,
  sbBomb,
} from "./utils/core";
import fuzzy from "fuzzy";

type Props = {
  textarea: HTMLTextAreaElement;
  triggerStart: number;
  triggerRegex: RegExp;
  isCustomOnly: boolean;
  extensionAPI: OnloadArgs["extensionAPI"];
};

// The block doesn't always have the trigger saved, causing weird race condition errors
const waitForBlock = (uid: string, text: string): Promise<void> =>
  getTextByBlockUid(uid) === text
    ? Promise.resolve()
    : new Promise((resolve) =>
        setTimeout(() => resolve(waitForBlock(uid, text)), 10)
      );

const SmartblocksMenu = ({
  onClose,
  textarea,
  triggerStart,
  triggerRegex,
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
  const [filter, setFilter] = useState("");
  const initialWorkflows = useMemo(() => {
    // built-ins that prompt are left out of the Sidecar: prompts open in the main window
    const inMainWindow = textarea.ownerDocument === document;
    return getVisibleCustomWorkflows()
      .sort(({ name: a }, { name: b }) => a.localeCompare(b))
      .concat(
        isCustomOnly
          ? []
          : predefinedWorkflows.filter(
              (wf) =>
                inMainWindow ||
                !(wf.children || []).some((c) => c.text.includes("<%INPUT"))
            )
      );
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
  const onSelect = useCallback(
    (index) => {
      if (!menuRef.current) return;
      const item =
        menuRef.current.children[index].querySelector(".bp3-menu-item");
      if (!item) return;
      const srcName = item.getAttribute("data-name");
      const srcUid = item.getAttribute("data-uid");
      if (!srcName || !srcUid) return;
      const currentTextarea = textarea.ownerDocument.getElementById(
        textarea.id
      ) as HTMLTextAreaElement;
      waitForBlock(blockUid, textarea.value).then(() => {
        onClose();
        setTimeout(() => {
          sbBomb({
            srcUid,
            target: {
              uid: blockUid,
              start: triggerStart,
              end: currentTextarea.selectionStart,
              windowId,
            },
            mutableCursor: !srcName.includes("<%NOCURSOR%>"),
          });
        }, 10);
      });
    },
    [menuRef, blockUid, onClose, triggerStart, textarea]
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
        onSelect(index);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === "Escape") {
        onClose();
      } else {
        const value =
          triggerRegex.exec(
            textarea.value.substring(0, textarea.selectionStart)
          )?.[1] || "";
        if (value) {
          setFilter(value);
        } else {
          onClose();
          return;
        }
      }
    },
    [menuRef, setActiveIndex, setFilter, onClose, triggerRegex, textarea]
  );
  useEffect(() => {
    const listeningEl = !!textarea.closest(".rm-reference-item")
      ? textarea.parentElement // Roam rerenders a new textarea in linked references on every keypress
      : textarea;
    listeningEl?.addEventListener("keydown", keydownListener);
    return () => {
      listeningEl?.removeEventListener("keydown", keydownListener);
    };
  }, [keydownListener]);
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
      enforceFocus={false}
      portalContainer={textarea.ownerDocument.body}
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
                  onMouseEnter={() => setActiveIndex(i)}
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
  const doc = props.textarea.ownerDocument;
  const parent = doc.createElement("span");
  const coords = getCoords(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement?.insertBefore(parent, props.textarea);
  const block = window.roamAlphaAPI.ui.getFocusedBlock();
  // close once its block is no longer being edited (a click elsewhere, the Sidecar hiding or
  // losing the keyboard, another card) or its anchor is gone (Roam re-rendered the editor)
  const observer = new (doc.defaultView || window).MutationObserver(() => {
    const focused = window.roamAlphaAPI.ui.getFocusedBlock();
    if (
      !parent.isConnected ||
      focused?.["block-uid"] !== block?.["block-uid"] ||
      focused?.["window-id"] !== block?.["window-id"]
    )
      close();
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    observer.disconnect();
    props.onClose();
    ReactDOM.unmountComponentAtNode(parent);
    parent.remove();
  };
  ReactDOM.render(<SmartblocksMenu {...props} onClose={close} />, parent);
  return close;
};

export default SmartblocksMenu;
