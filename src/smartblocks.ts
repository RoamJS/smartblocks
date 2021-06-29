import {
  getTreeByBlockUid,
  getOrderByBlockUid,
  getParentUidByBlockUid,
  updateBlock,
  createBlock,
  getTextByBlockUid,
} from "roam-client";

// ridiculous method names in this file are a tribute to the original author of SmartBlocks, RoamHacker 🙌
export const sbBomb = ({
  srcUid,
  target: { uid, start, end },
}: {
  srcUid: string;
  target: { uid: string; start: number; end: number };
}) => {
  const [firstChild, ...tree] = getTreeByBlockUid(srcUid).children;
  const startingOrder = getOrderByBlockUid(uid);
  const parentUid = getParentUidByBlockUid(uid);
  const originalText = getTextByBlockUid(uid);
  updateBlock({
    uid,
    text: `${originalText.substring(0, start)}${
      firstChild.text
    }${originalText.substring(end)}`,
  });
  firstChild.children.forEach((node, order) =>
    createBlock({ order, parentUid: uid, node })
  );
  tree.forEach((node, i) =>
    createBlock({ parentUid, order: startingOrder + 1 + i, node })
  );
};
