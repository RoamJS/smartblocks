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

type Props = {
  textarea: HTMLTextAreaElement;
};

const getWorkflows = (tag: string) =>
  getBlockUidsAndTextsReferencingPage(tag).map(({ text, uid }) => ({
    uid,
    name: text.replace(createTagRegex(tag), "").trim(),
  }));

const SmartblocksMenu = ({
  onClose,
  textarea,
}: { onClose: () => void } & Props) => {
  const blockUid = useMemo(() => getUids(textarea).blockUid, [textarea]);
  const menuRef = useRef<HTMLUListElement>(null);
  const [filter, setFilter] = useState("");
  const filterRegex = useMemo(() => new RegExp(`(${filter})`, "i"), [filter]);
  const initialWorkflows = useMemo(() => {
    return [
      ...getWorkflows("42SmartBlock"),
      ...getWorkflows("SmartBlock"),
    ].sort(({ name: a }, { name: b }) => a.localeCompare(b));
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
      const uid = menuRef.current.children[index].querySelector('.bp3-menu-item').getAttribute("data-uid");
      const [firstChild, ...tree] = getTreeByBlockUid(uid).children;
      const startingOrder = getOrderByBlockUid(blockUid);
      const parentUid = getParentUidByBlockUid(blockUid);
      updateBlock({ uid: blockUid, text: firstChild.text });
      firstChild.children.forEach((node, order) =>
        createBlock({ order, parentUid: blockUid, node })
      );
      tree.forEach((node, i) =>
        createBlock({ parentUid, order: startingOrder + 1 + i, node })
      );
      onClose();
    },
    [menuRef, blockUid, onClose]
  );
  const inputListener = useCallback(
    (e: InputEvent) => {
      const value = menuRef.current.getAttribute("data-filter");
      if (!e.data) {
        if (e.inputType === "deleteContentBackward") {
          if (!value) {
            onClose();
          } else {
            setFilter(value.slice(-1));
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
        <Menu
          ulRef={menuRef}
          data-active-index={activeIndex}
          data-filter={filter}
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
      }
    />
  );
};

export const render = (props: Props) => {
  const parent = document.createElement("span");
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
