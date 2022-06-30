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
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { RoamBasicNode } from "roamjs-components/types";
import { getCoords } from "./dom";
import lego from "./img/lego3blocks.png";
import gear from "./img/gear.png";
import {
  getVisibleCustomWorkflows,
  predefinedWorkflows,
  PREDEFINED_REGEX,
  sbBomb,
} from "./core";
import fuzzy from "fuzzy";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import axios from "axios";

type Props = {
  textarea: HTMLTextAreaElement;
  triggerLength: number;
  isCustomOnly: boolean;
  dailyConfig?: RoamBasicNode;
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
  triggerLength,
  isCustomOnly,
  dailyConfig,
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
    (index, clicked = false) => {
      const item =
        menuRef.current.children[index].querySelector(".bp3-menu-item");
      const srcName = item.getAttribute("data-name");
      const srcUid = item.getAttribute("data-uid");
      const currentTextarea = document.getElementById(
        textarea.id
      ) as HTMLTextAreaElement;
      const start = currentTextarea.selectionStart - triggerLength;
      const end = currentTextarea.selectionStart;
      waitForBlock(blockUid, textarea.value).then(() => {
        onClose();
        setTimeout(() => {
          sbBomb({
            srcUid,
            target: {
              uid: blockUid,
              start,
              end,
              windowId,
            },
            mutableCursor: !srcName.includes("<%NOCURSOR%>"),
          }).then(() => {
            if (dailyConfig) {
              const dailyWorkflowName = getSettingValueFromTree({
                tree: dailyConfig.children,
                key: "workflow name",
                defaultValue: "Daily",
              });
              if (dailyWorkflowName === srcName) {
                const title = getPageTitleByBlockUid(blockUid);
                if (DAILY_NOTE_PAGE_REGEX.test(title)) {
                  const newDate = getPageUidByPageTitle(title);
                  const uuid = getSettingValueFromTree({
                    tree: dailyConfig.children,
                    key: "latest",
                  });
                  axios.put(`${process.env.API_URL}/smartblocks-daily`, {
                    newDate,
                    uuid,
                  });
                }
              }
            }
          });
        }, 10);
      });
    },
    [menuRef, blockUid, onClose, triggerLength, textarea]
  );
  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        const count = menuRef.current.childElementCount;
        setActiveIndex((index + 1) % count);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        const count = menuRef.current.childElementCount;
        setActiveIndex((index - 1 + count) % count);
      } else if (e.key === "Enter") {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        onSelect(index);
      } else if (e.key.length === 1) {
        const value = menuRef.current.getAttribute("data-filter");
        setFilter(`${value}${e.key}`);
      } else if (e.key === "Backspace") {
        const value = menuRef.current.getAttribute("data-filter");
        if (value) {
          setFilter(value.slice(0, -1));
        } else {
          onClose();
          return;
        }
      } else if (window.roamAlphaAPI.platform.isMobile) {
        const value = menuRef.current.getAttribute("data-filter");
        setFilter(`${value}${String.fromCharCode(e.keyCode)}`);
      } else if (e.key !== "Shift") {
        onClose();
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    },
    [menuRef, setActiveIndex, setFilter, onClose]
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
          data-filter={filter}
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
                        src={PREDEFINED_REGEX.test(wf.uid) ? gear : lego}
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
                  onClick={() => onSelect(i, true)}
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

export const render = (props: Props) => {
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
        ReactDOM.unmountComponentAtNode(parent);
        parent.remove();
      }}
    />,
    parent
  );
};

export default SmartblocksMenu;
