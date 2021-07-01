import {
  getTreeByBlockUid,
  getOrderByBlockUid,
  getParentUidByBlockUid,
  updateBlock,
  createBlock,
  getTextByBlockUid,
  InputTextNode,
  toRoamDate,
  getBlockUidsAndTextsReferencingPage,
  createTagRegex,
} from "roam-client";
import { parseDate } from "chrono-node";
import datefnsFormat from "date-fns/format";

export const PREDEFINED_REGEX = /#\d*-predefined/;

export const predefinedWorkflows = (
  [
    ...[
      "today",
      "tomorrow",
      "yesterday",
      ...[
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ].flatMap((e) => [`This ${e}`, `Last ${e}`, `Next ${e}`]),
    ].map((text) => ({
      text,
      children: [{ text: `<%DATE:${text}%>` }],
    })),
    { text: "Time 24", children: [{ text: "<%TIME%>" }] },
    { text: "Time AM/PM", children: [{ text: "<%TIMEAMPM%>" }] },
  ] as InputTextNode[]
).map((s, i) => ({
  name: s.text,
  children: s.children,
  uid: PREDEFINED_REGEX.source.replace("\\d*", i.toString()),
}));

const predefinedChildrenByUid = Object.fromEntries(
  predefinedWorkflows.map((pw) => [pw.uid, pw.children])
);

const HIDE_REGEX = /<%HIDE%>/;
const getWorkflows = (tag: string) =>
  getBlockUidsAndTextsReferencingPage(tag).map(({ text, uid }) => ({
    uid,
    name: text.replace(createTagRegex(tag), "").trim(),
  }));
export const getCustomWorkflows = () =>
  [...getWorkflows("42SmartBlock"), ...getWorkflows("SmartBlock")]
    .filter(({ name }) => !HIDE_REGEX.test(name))
    .map(({ name, uid }) => ({
      uid,
      name: name.replace(HIDE_REGEX, ""),
    }));

const COMMAND_REGEX = /<%([A-Z0-9]*)(?::(.*))?%>/;
const COMMANDS: {
  text: string;
  help: string;
  args?: true;
  handler: (args?: string[]) => string;
}[] = [
  {
    text: "DATE",
    help: "Returns a Roam formatted dated page reference.\n\n1: NLP expression\n2: optional: format for returned date, example: YYYY-MM-DD",
    args: true,
    handler: ([nlp, format]) => {
      if (!nlp) {
        return `[[${toRoamDate(new Date())}]]`;
      }
      const date = parseDate(nlp);
      if (format) {
        return datefnsFormat(date, format);
      }
      return `[[${toRoamDate(date)}]]`;
    },
  },
  {
    text: "TIME",
    help: "Returns time in 24 hour format",
    handler: () => {
      const dt = new Date();
      return (
        dt.getHours().toString().padStart(2, "0") +
        ":" +
        dt.getMinutes().toString().padStart(2, "0")
      );
    },
  },
  {
    text: "TIMEAMPM",
    help: "Returns time in AM/PM format.",
    handler: () => {
      const dt = new Date();
      const hours = dt.getHours();
      const minutes = dt.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      const hoursAm = hours ? hours % 12 : 12;
      var strTime =
        hoursAm.toString().padStart(2, "0") +
        ":" +
        minutes.toString().padStart(2, "0") +
        " " +
        ampm;
      return strTime;
    },
  },
];
const handlerByCommand = Object.fromEntries(
  COMMANDS.map((c) => [c.text, c.handler])
);

// ridiculous method names in this file are a tribute to the original author of SmartBlocks, RoamHacker 🙌
const proccessBlockWithSmartness = (n: InputTextNode): InputTextNode => {
  return {
    text: n.text.replace(COMMAND_REGEX, (_, cmd, args) =>
      handlerByCommand[cmd](args && args.split(","))
    ),
    children: (n.children || []).map((c) => proccessBlockWithSmartness(c)),
  };
};

export const sbBomb = ({
  srcUid,
  target: { uid, start, end },
}: {
  srcUid: string;
  target: { uid: string; start: number; end: number };
}) => {
  const childNodes = PREDEFINED_REGEX.test(srcUid)
    ? predefinedChildrenByUid[srcUid]
    : getTreeByBlockUid(srcUid).children;
  const [firstChild, ...tree] = childNodes.map((n) =>
    proccessBlockWithSmartness(n)
  );
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
