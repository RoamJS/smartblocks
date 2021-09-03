import {
  Button,
  Classes,
  Intent,
  Popover,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import {
  createBlock,
  getBasicTreeByParentUid,
  getBlockUidFromTarget,
  getBlockUidsReferencingBlock,
  getCurrentPageUid,
  getDisplayNameByUid,
  getFirstChildTextByBlockUid,
  getFirstChildUidByBlockUid,
  getGraph,
  getPageUidByPageTitle,
  getShallowTreeByParentUid,
  getTreeByBlockUid,
  InputTextNode,
  TreeNode,
  updateBlock,
} from "roam-client";
import {
  getSettingValueFromTree,
  getSubTree,
  renderToast,
  toFlexRegex,
  useSubTree,
} from "roamjs-components";
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
  const pageUid = useMemo(
    () => getPageUidByPageTitle("roam/js/smartblocks"),
    []
  );
  const pageTree = useMemo(() => getBasicTreeByParentUid(pageUid), [pageUid]);
  const { uid: publishUid, children: publishChildren } = useSubTree({
    tree: pageTree,
    key: "publish",
    parentUid: pageUid,
    order: 3,
  });
  const tokenUid = useMemo(
    () =>
      publishChildren.find((t) => toFlexRegex("token").test(t.text))?.uid || "",
    [publishChildren]
  );
  const token = useMemo(
    () => (tokenUid && getFirstChildTextByBlockUid(tokenUid)) || "",
    [tokenUid]
  );
  const displayName = useMemo(
    () =>
      getSettingValueFromTree({
        tree: publishChildren,
        key: "display name",
        defaultValue: getDisplayNameByUid(getCurrentPageUid()),
      }),
    [publishChildren]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) {
      setError(
        "Token necessary for publishing Smartblocks Workflows. Please head to the [[roam/js/smartblocks]] page to generate one."
      );
    }
  }, [token]);
  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", width: 180 }}>
        <Button
          disabled={!token}
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
                price = [],
              } = Object.fromEntries(
                getBlockUidsReferencingBlock(blockUid).flatMap((uid) =>
                  getTreeByBlockUid(uid).children.map((t) => [
                    t.text.trim().toLowerCase(),
                    t.children.map((t) => t.text),
                  ])
                )
              );
              axios
                .put(
                  `${process.env.API_URL}/smartblocks-store`,
                  {
                    uuid: uuid[0],
                    name: text
                      .replace(/#(42)?SmartBlock/, "")
                      .replace(HIDE_REGEX, "")
                      .trim(),
                    tags,
                    img: image[0],
                    author: getGraph(),
                    description: (description[0] || "").replace(/__/g, "_"),
                    workflow: JSON.stringify(children.map(toInputTextNode)),
                    price: Number(price[0] || "0") || 0,
                    displayName,
                  },
                  { headers: { Authorization: token } }
                )
                .then((r) => {
                  const ref = `((${blockUid}))`;
                  const refUid =
                    publishChildren.find((t) => t.text.trim() === ref)?.uid ||
                    createBlock({
                      node: { text: ref },
                      parentUid: publishUid,
                      order: 1,
                    });
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
                      renderToast({
                        id: "roamjs-smartblock-publish-success",
                        content: `Successfully published workflow to the SmartBlocks Store!${
                          r.data.requiresReview
                            ? "\n\nBecause your workflow contains custom JavaScript, it will first undergo review by RoamJS before going live."
                            : ""
                        }`,
                        intent: r.data.requiresReview
                          ? Intent.WARNING
                          : Intent.SUCCESS,
                      });
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
      </div>
      <div style={{ width: 180, lineHeight: "0.75em", marginTop: 4 }}>
        <span style={{ color: "darkred", fontSize: 12 }}>{error}</span>
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
