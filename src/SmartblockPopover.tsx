import React from "react";
import ReactDOM from "react-dom";
import type {
  InputTextNode,
  OnloadArgs,
  TreeNode,
} from "roamjs-components/types";

const toInputTextNode = (n: TreeNode): InputTextNode => ({
  text: n.text,
  children: n.children.map(toInputTextNode),
});

const SmartblockPopover = (): React.ReactElement => {
  return (
    <img
      className={"roamjs-smartblocks-popover-target"}
      src={
        "https://raw.githubusercontent.com/RoamJS/smartblocks/main/src/img/lego3blocks.png"
      }
    />
  );
};

export const render = (s: HTMLSpanElement) => {
  ReactDOM.render(<SmartblockPopover />, s);
};

export default SmartblockPopover;
