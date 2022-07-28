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
import { getCoords } from "./dom";
import {
  getVisibleCustomWorkflows,
  predefinedWorkflows,
  PREDEFINED_REGEX,
  sbBomb,
} from "./core";
import fuzzy from "fuzzy";
import apiPut from "roamjs-components/util/apiPut";

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
    () => window.roamAlphaAPI.ui.getFocusedBlock(),
    []
  );
  const menuRef = useRef<HTMLUListElement>(null);
  const [filter, setFilter] = useState("");
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
  const onSelect = useCallback(
    (index) => {
      const item =
        menuRef.current.children[index].querySelector(".bp3-menu-item");
      const srcName = item.getAttribute("data-name");
      const srcUid = item.getAttribute("data-uid");
      const currentTextarea = document.getElementById(
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
          }).then(() => {
            const dailyConfig = extensionAPI.settings.get("daily") as Record<
              string,
              string
            >;
            if (dailyConfig) {
              const dailyWorkflowName = dailyConfig["workflow name"] || "";
              if (dailyWorkflowName === srcName) {
                const title = getPageTitleByBlockUid(blockUid);
                if (DAILY_NOTE_PAGE_REGEX.test(title)) {
                  const newDate = getPageUidByPageTitle(title);
                  const uuid = dailyConfig["latest"];
                  apiPut({
                    path: `smartblocks-daily`,
                    data: {
                      newDate,
                      uuid,
                    },
                    anonymous: true,
                  });
                }
              }
            }
          });
        }, 10);
      });
    },
    [menuRef, blockUid, onClose, triggerStart, textarea]
  );
  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        const count = menuRef.current.childElementCount;
        setActiveIndex((index + 1) % count);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
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
    listeningEl.addEventListener("keydown", keydownListener);
    return () => {
      listeningEl.removeEventListener("keydown", keydownListener);
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
                            ? "https://raw.githubusercontent.com/dvargas92495/roamjs-smartblocks/main/src/img/gear.png"
                            : "https://raw.githubusercontent.com/dvargas92495/roamjs-smartblocks/main/src/img/lego3blocks.png"
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
  const parent = document.createElement("span");
  const coords = getCoords(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement.insertBefore(parent, props.textarea);
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
