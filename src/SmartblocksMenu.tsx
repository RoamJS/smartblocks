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
  createBlock,
  createTagRegex,
  getBlockUidsAndTextsReferencingPage,
  getOrderByBlockUid,
  getParentUidByBlockUid,
  getTreeByBlockUid,
  getUids,
  updateBlock,
} from "roam-client";
import { getCoords } from "./dom";
import lego from "./img/lego3blocks.png";
import { sbBomb } from "./smartblocks";

type Props = {
  textarea: HTMLTextAreaElement;
  triggerLength: number;
};

const HIDE_REGEX = /<%HIDE%>/;
const getWorkflows = (tag: string) =>
  getBlockUidsAndTextsReferencingPage(tag).map(({ text, uid }) => ({
    uid,
    name: text.replace(createTagRegex(tag), "").trim(),
  }));

const SmartblocksMenu = ({
  onClose,
  textarea,
  triggerLength,
}: { onClose: () => void } & Props) => {
  const blockUid = useMemo(() => getUids(textarea).blockUid, [textarea]);
  const menuRef = useRef<HTMLUListElement>(null);
  const [filter, setFilter] = useState("");
  const filterRegex = useMemo(() => new RegExp(`(${filter})`, "i"), [filter]);
  const initialWorkflows = useMemo(() => {
    return [...getWorkflows("42SmartBlock"), ...getWorkflows("SmartBlock")]
      .filter(({ name }) => !HIDE_REGEX.test(name))
      .map(({ name, uid }) => ({ uid, name: name.replace(HIDE_REGEX, "") }))
      .sort(({ name: a }, { name: b }) => a.localeCompare(b));
  }, []);
  const workflows = useMemo(() => {
    if (filter) {
      return initialWorkflows.filter(({ name }) => filterRegex.test(name));
    } else {
      return initialWorkflows;
    }
  }, [filter, initialWorkflows]);
  const [activeIndex, setActiveIndex] = useState(0);
  const onSelect = useCallback(
    (index) => {
      const uid = menuRef.current.children[index]
        .querySelector(".bp3-menu-item")
        .getAttribute("data-uid");
      const value = menuRef.current.getAttribute("data-filter");
      sbBomb({
        srcUid: uid,
        target: {
          uid: blockUid,
          start: textarea.selectionStart - triggerLength - value.length,
          end: textarea.selectionStart,
        },
      });
      onClose();
    },
    [menuRef, blockUid, onClose, triggerLength, textarea]
  );
  const inputListener = useCallback(
    (e: InputEvent) => {
      const value = menuRef.current.getAttribute("data-filter");
      if (!e.data) {
        if (e.inputType === "deleteContentBackward") {
          if (!value) {
            onClose();
          } else {
            setFilter(value.slice(0, -1));
          }
        }
      } else {
        setFilter(`${value}${e.data}`);
      }
      e.stopPropagation();
      e.preventDefault();
    },
    [setFilter, menuRef]
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
      } else {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    },
    [menuRef, setActiveIndex]
  );
  useEffect(() => {
    textarea.addEventListener("input", inputListener);
    textarea.addEventListener("keydown", keydownListener);
    return () => {
      textarea.removeEventListener("input", inputListener);
      textarea.removeEventListener("keydown", keydownListener);
    };
  }, [inputListener, keydownListener]);
  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      canEscapeKeyClose
      minimal
      target={<span />}
      position={Position.BOTTOM_RIGHT}
      content={
        workflows.length ? (
          <Menu
            ulRef={menuRef}
            data-active-index={activeIndex}
            data-filter={filter}
            style={{ width: 300 }}
          >
            {workflows.map((wf, i) => {
              const parts = filter
                ? wf.name.split(new RegExp(`(${filter})`, "i"))
                : [wf.name];
              return (
                <MenuItem
                  key={wf.uid}
                  data-uid={wf.uid}
                  text={
                    <>
                      <img src={lego} alt={""} width={15} />
                      {parts.map((part, i) =>
                        filter && filterRegex.test(part) ? (
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
            })}
          </Menu>
        ) : (
          <span>No Workflows Found</span>
        )
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
