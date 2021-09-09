import { Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import {
  DAILY_NOTE_PAGE_REGEX,
  getPageTitleByBlockUid,
  getPageUidByPageTitle,
  getUids,
  RoamBasicNode,
} from "roam-client";
import { getCoords } from "./dom";
import lego from "./img/lego3blocks.png";
import gear from "./img/gear.png";
import {
  getVisibleCustomWorkflows,
  predefinedWorkflows,
  PREDEFINED_REGEX,
  sbBomb,
} from "./smartblocks";
import fuzzy from "fuzzy";
import { getSettingValueFromTree, setInputSetting } from "roamjs-components";

type Props = {
  textarea: HTMLTextAreaElement;
  triggerLength: number;
  isCustomOnly: boolean;
  dailyConfig?: RoamBasicNode;
};

const VALID_FILTER = /^[\w\d\s_-]$/;

const SmartblocksMenu = ({
  onClose,
  textarea,
  triggerLength,
  isCustomOnly,
  dailyConfig,
}: { onClose: () => void } & Props) => {
  const blockUid = useMemo(() => getUids(textarea).blockUid, [textarea]);
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
      const start = textarea.selectionStart - triggerLength;
      const end = textarea.selectionStart;
      onClose();
      setTimeout(() => {
        sbBomb({
          srcUid,
          target: {
            uid: blockUid,
            start,
            end,
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
                const value = getPageUidByPageTitle(title);
                setInputSetting({
                  blockUid: dailyConfig.uid,
                  value,
                  key: "latest",
                  index: 2,
                });
              }
            }
          }
        });
      }, 10);
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
      } else if (VALID_FILTER.test(e.key)) {
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
    textarea.addEventListener("keydown", keydownListener);
    return () => {
      textarea.removeEventListener("keydown", keydownListener);
    };
  }, [keydownListener]);
  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      canEscapeKeyClose
      minimal
      target={<span />}
      position={Position.BOTTOM_RIGHT}
      content={
        <Menu
          ulRef={menuRef}
          data-active-index={activeIndex}
          data-filter={filter}
          style={{ width: 300 }}
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
