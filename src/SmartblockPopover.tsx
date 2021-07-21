import {
  Button,
  Classes,
  Intent,
  Popover,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import axios from "axios";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom";
import {
  createBlock,
  getBlockUidFromTarget,
  getBlockUidsReferencingBlock,
  getFirstChildUidByBlockUid,
  getGraph,
  getPageUidByPageTitle,
  getShallowTreeByParentUid,
  getTreeByBlockUid,
  InputTextNode,
  TreeNode,
  updateBlock,
} from "roam-client";
import { renderWarningToast, toFlexRegex } from "roamjs-components";
import lego from "./img/lego3blocks.png";
import { HIDE_REGEX } from "./smartblocks";

const toInputTextNode = (n: TreeNode): InputTextNode => ({
  text: n.text,
  children: n.children.map(toInputTextNode),
});

const Content = ({
  blockUid,
  onClose,
}: {
  blockUid: string;
  onClose: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  return (
    <div style={{ padding: 32 }}>
      <div style={{ width: 180, display: "flex", alignItems: "center" }}>
        <Button
          text={"Publish Workflow"}
          intent={Intent.PRIMARY}
          style={{ marginRight: 16, width: 140 }}
          onClick={() => {
            setLoading(true);
            setError("");
            setTimeout(() => {
              const { text, children } = getTreeByBlockUid(blockUid);
              const {
                description = [],
                image = [],
                tags = [],
                uuid = [],
              } = Object.fromEntries(
                getBlockUidsReferencingBlock(blockUid).flatMap((uid) =>
                  getTreeByBlockUid(uid).children.map((t) => [
                    t.text.trim().toLowerCase(),
                    t.children.map((t) => t.text),
                  ])
                )
              );
              axios
                .put(`${process.env.API_URL}/smartblocks-store`, {
                  uuid: uuid[0],
                  name: text
                    .replace(/#(42)?SmartBlock/, "")
                    .replace(HIDE_REGEX, "")
                    .trim(),
                  tags,
                  img: image[0],
                  author: getGraph(),
                  description: description[0],
                  workflow: JSON.stringify(children.map(toInputTextNode)),
                })
                .then((r) => {
                  const pageUid = getPageUidByPageTitle("roam/js/smartblocks");
                  const parentUid =
                    getShallowTreeByParentUid(pageUid).find((t) =>
                      toFlexRegex("publish").test(t.text)
                    )?.uid ||
                    createBlock({
                      node: { text: "publish" },
                      parentUid: pageUid,
                      order: 3,
                    });
                  const ref = `((${blockUid}))`;
                  setTimeout(() => {
                    const refUid =
                      getShallowTreeByParentUid(parentUid).find(
                        (t) => t.text.trim() === ref
                      )?.uid ||
                      createBlock({ node: { text: ref }, parentUid, order: 1 });
                    setTimeout(() => {
                      const uuidUid =
                        getShallowTreeByParentUid(refUid).find((t) =>
                          toFlexRegex("uuid").test(t.text)
                        )?.uid ||
                        createBlock({
                          node: { text: "uuid" },
                          parentUid: refUid,
                        });
                      setTimeout(() => {
                        const valueUid = getFirstChildUidByBlockUid(uuidUid);
                        if (valueUid) {
                          updateBlock({ text: r.data.uuid, uid: valueUid });
                        } else {
                          createBlock({
                            node: { text: r.data.uuid },
                            parentUid: uuidUid,
                          });
                        }
                        onClose();
                        renderWarningToast({
                          id: "roamjs-smartblock-publish-success",
                          content: `Successfully published workflow to the SmartBlocks Store!${
                            r.data.requiresReview
                              ? "\n\nBecause your workflow contains custom JavaScript, it will first undergo review by RoamJS before going live."
                              : ""
                          }`,
                        });
                      }, 1);
                    }, 1);
                  }, 1);
                })
                .catch((e) => {
                  setError(e.response?.data || e.message);
                  setLoading(false);
                });
            }, 1);
          }}
        />
        <span>{loading && <Spinner size={SpinnerSize.SMALL} />}</span>
        <span style={{ color: "darkred", fontSize: 8 }}>{error}</span>
      </div>
    </div>
  );
};

const SmartblockPopover = ({
  blockUid,
}: {
  blockUid: string;
}): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const onClose = useCallback(() => setIsOpen(false), [setIsOpen]);
  return (
    <Popover
      target={
        <img className={"roamjs-smartblocks-popover-target"} src={lego} />
      }
      content={<Content blockUid={blockUid} onClose={onClose} />}
      isOpen={isOpen}
      onInteraction={(n) => setIsOpen(n)}
    />
  );
};

export const render = (s: HTMLSpanElement) => {
  const blockUid = getBlockUidFromTarget(s);
  ReactDOM.render(<SmartblockPopover blockUid={blockUid} />, s);
};

export default SmartblockPopover;
