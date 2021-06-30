import {
  getTreeByBlockUid,
  getOrderByBlockUid,
  getParentUidByBlockUid,
  updateBlock,
  createBlock,
  getTextByBlockUid,
  InputTextNode,
} from "roam-client";

export const PREDEFINED_REGEX = /#\d*-predefined/;

export const predefinedWorkflows = (
  [
    { text: "today", children: [{ text: "<%DATE:today%>" }] },
    { text: "tomorrow", children: [{ text: "<%DATE:tomorrow%>" }] },
    { text: "yesterday", children: [{ text: "<%DATE:yesterday%>" }] },
  ] as InputTextNode[]
).map((s, i) => ({
  name: s.text,
  children: s.children,
  uid: PREDEFINED_REGEX.source.replace("\\d*", i.toString()),
}));

const predefinedChildrenByUid = Object.fromEntries(
  predefinedWorkflows.map((pw) => [pw.uid, pw.children])
);

// ridiculous method names in this file are a tribute to the original author of SmartBlocks, RoamHacker 🙌
export const sbBomb = ({
  srcUid,
  target: { uid, start, end },
}: {
  srcUid: string;
  target: { uid: string; start: number; end: number };
}) => {
  const [firstChild, ...tree] = PREDEFINED_REGEX.test(srcUid)
    ? predefinedChildrenByUid[srcUid]
    : getTreeByBlockUid(srcUid).children;
  const startingOrder = getOrderByBlockUid(uid);
  const parentUid = getParentUidByBlockUid(uid);
  const originalText = getTextByBlockUid(uid);
  updateBlock({
    uid,
    text: `${originalText.substring(0, start)}${
      firstChild.text
    }${originalText.substring(end)}`,
  });
  (firstChild?.children || []).forEach((node, order) =>
    createBlock({ order, parentUid: uid, node })
  );
  tree.forEach((node, i) =>
    createBlock({ parentUid, order: startingOrder + 1 + i, node })
  );
};
