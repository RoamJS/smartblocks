import {
  DAILY_NOTE_PAGE_REGEX,
  DAILY_NOTE_PAGE_TITLE_REGEX,
} from "roamjs-components/date/constants";
import getOrderByBlockUid from "roamjs-components/queries/getOrderByBlockUid";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import createBlock from "roamjs-components/writes/createBlock";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import {
  InputTextNode,
  PullBlock,
  RoamBasicNode,
} from "roamjs-components/types/native";
import getBlockUidsAndTextsReferencingPage from "roamjs-components/queries/getBlockUidsAndTextsReferencingPage";
import createTagRegex from "roamjs-components/util/createTagRegex";
import getAllBlockUids from "roamjs-components/queries/getAllBlockUids";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import extractRef from "roamjs-components/util/extractRef";
import extractTag from "roamjs-components/util/extractTag";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import getParentUidsOfBlockUid from "roamjs-components/queries/getParentUidsOfBlockUid";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import getBlockUidAndTextIncludingText from "roamjs-components/queries/getBlockUidAndTextIncludingText";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import createPage from "roamjs-components/writes/createPage";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import getBlockUidsReferencingBlock from "roamjs-components/queries/getBlockUidsReferencingBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import datefnsFormat from "date-fns/format";
import addDays from "date-fns/addDays";
import addMonths from "date-fns/addMonths";
import addYears from "date-fns/addYears";
import subDays from "date-fns/subDays";
import isBefore from "date-fns/isBefore";
import isAfter from "date-fns/isAfter";
import endOfDay from "date-fns/endOfDay";
import startOfDay from "date-fns/startOfDay";
import startOfMonth from "date-fns/startOfMonth";
import startOfYear from "date-fns/startOfYear";
import endOfMonth from "date-fns/endOfMonth";
import endOfYear from "date-fns/endOfYear";
import differenceInDays from "date-fns/differenceInDays";
import XRegExp from "xregexp";
import { renderPrompt } from "../Prompt";
import { render as renderToast } from "roamjs-components/components/Toast";
import { ToasterPosition } from "@blueprintjs/core";
import { renderLoading } from "roamjs-components/components/Loading";
import lodashGet from "lodash/get";
import getUids from "roamjs-components/dom/getUids";
import parseNlpDate, {
  addNlpDateParser,
} from "roamjs-components/date/parseNlpDate";
import apiGet from "roamjs-components/util/apiGet";
import { render as renderSimpleAlert } from "roamjs-components/components/SimpleAlert";
import FormDialog from "roamjs-components/components/FormDialog";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSettingValuesFromTree from "roamjs-components/util/getSettingValuesFromTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import getDailyConfig from "./getDailyConfig";
import scheduleNextDailyRun from "./scheduleNextDailyRun";
import apiPost from "roamjs-components/util/apiPost";
import deleteBlock from "roamjs-components/writes/deleteBlock";

type FormDialogProps = Parameters<typeof FormDialog>[0];
const renderFormDialog = createOverlayRender<FormDialogProps>(
  "form-dialog",
  FormDialog
);

export const PREDEFINED_REGEX = /#\d*-predefined/;
const PAGE_TITLE_REGEX = /^(?:#?\[\[(.*)\]\]|#([^\s]*))$/;
const DAILY_REF_REGEX = new RegExp(
  `#?\\[\\[(${DAILY_NOTE_PAGE_REGEX.source})\\]\\]`
);

const getBlockUidTextAndPageReferencingTag = (title: string) =>
  window.roamAlphaAPI.data.fast
    .q(
      `[:find (pull ?r [:block/uid :block/string]) (pull ?t [:node/title]) :where [?p :node/title "${normalizePageTitle(
        title
      )}"] [?r :block/refs ?p] [?r :block/page ?t]]`
    )
    .map((r) => {
      const [block, page] = r as PullBlock[];
      return {
        text: block?.[":block/string"] || "",
        uid: block?.[":block/uid"] || "",
        title: page?.[":node/title"] || "",
      };
    });

const flattenPullBlock = (blocks: PullBlock[] = []): PullBlock[] =>
  blocks.flatMap((b) => [b, ...flattenPullBlock(b[":block/children"])]);

const getAttributeValueByBlockAndName = ({
  name,
  uid,
}: {
  name: string;
  uid: string;
}) => {
  const blocks = flattenPullBlock(
    window.roamAlphaAPI.pull(
      "[:block/string :block/uid {:block/children ...}]",
      [":block/uid", uid]
    )?.[":block/children"]
  );
  const block = blocks.find((blk) =>
    (blk[":block/string"] || "").startsWith(name + "::")
  );
  return (block?.[":block/string"] || "").slice(name.length + 2).trim();
};

const getDateFromBlock = (args: { text: string; title: string }) => {
  const fromText = DAILY_REF_REGEX.exec(args.text)?.[1];
  if (fromText) return window.roamAlphaAPI.util.pageTitleToDate(fromText);
  const fromTitle = DAILY_NOTE_PAGE_TITLE_REGEX.exec(args.title)?.[0];
  if (fromTitle) return window.roamAlphaAPI.util.pageTitleToDate(fromTitle);
  return new Date("");
};
const getPageUidByBlockUid = (blockUid: string): string =>
  (
    window.roamAlphaAPI.q(
      `[:find (pull ?p [:block/uid]) :where [?e :block/uid "${blockUid}"] [?e :block/page ?p]]`
    )?.[0]?.[0] as { uid?: string }
  )?.uid || "";

const getDateBasisDate = () => {
  if (smartBlocksContext.variables["DATEBASISMETHOD"] === "DNP") {
    const title =
      getPageTitleByBlockUid(smartBlocksContext.targetUid) ||
      getPageTitleByPageUid(smartBlocksContext.targetUid);
    const dnp = DAILY_NOTE_PAGE_REGEX.test(title)
      ? window.roamAlphaAPI.util.pageTitleToDate(title) || new Date()
      : new Date();
    dnp.setHours(new Date().getHours());
    dnp.setMinutes(new Date().getMinutes());
    return dnp;
  } else if (smartBlocksContext.variables["DATEBASISMETHOD"]) {
    return new Date(smartBlocksContext.variables["DATEBASISMETHOD"]);
  } else {
    return new Date();
  }
};

const getTreeAtLevel = (
  tree: RoamBasicNode[],
  level: number
): RoamBasicNode[] => {
  if (!level) {
    return [];
  }
  return tree.map((t) => ({
    ...t,
    children: getTreeAtLevel(tree, level - 1),
  }));
};

const getUidFromText = (titleOrUid: string) => {
  const normText = smartBlocksContext.variables[titleOrUid] || titleOrUid;
  const possibleTitle = extractTag(normText);
  const parentUid =
    getPageUidByPageTitle(possibleTitle) || extractRef(possibleTitle);
  return !!window.roamAlphaAPI.pull("[:db/id]", [":block/uid", parentUid])
    ? parentUid
    : "";
};

const getLevelsBelowParentUid = (
  titleOrUid: string,
  levelsIncluded: string
) => {
  const parentUid = getUidFromText(titleOrUid);
  const levels = Number(levelsIncluded) || 0;
  const tree = getBasicTreeByParentUid(parentUid);
  return levels <= 0 || !levels ? tree : getTreeAtLevel(tree, levels);
};

addNlpDateParser({
  pattern: () => /D[B,E]O(N)?[M,Y]/i,
  extract: (_, match) => {
    const date = getDateBasisDate();
    const result = (d: Date) => ({
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    });

    switch (match[0]) {
      case "DBOM":
        return result(startOfMonth(date));
      case "DEOM":
        return result(endOfMonth(date));
      case "DBOY":
        return result(startOfYear(date));
      case "DEOY":
        return result(endOfYear(date));
      case "DBONM":
        return result(addMonths(startOfMonth(date), 1));
      case "DEONM":
        return result(addMonths(endOfMonth(date), 1));
      case "DBONY":
        return result(addYears(startOfYear(date), 1));
      case "DEONY":
        return result(addYears(endOfYear(date), 1));
      default:
        return result(date);
    }
  },
});

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
      children: [{ text: `<%DATE:${text}%><%CURSOR%>` }],
    })),
    { text: "Time 24", children: [{ text: "<%TIME%><%CURSOR%>" }] },
    { text: "Time AM/PM", children: [{ text: "<%TIMEAMPM%><%CURSOR%>" }] },
    { text: "Random Block", children: [{ text: "<%RANDOMBLOCK%>" }] },
    { text: "Random Page", children: [{ text: "<%RANDOMPAGE%>" }] },
    { text: "TODOs for Today", children: [{ text: "<%TODOTODAY%>" }] },
    { text: "TODOs Overdue", children: [{ text: "<%TODOOVERDUE%>" }] },
    { text: "TODOs Overdue + DNP", children: [{ text: "<%TODOOVERDUEDNP%>" }] },
    { text: "TODOs Future", children: [{ text: "<%TODOFUTURE%>" }] },
    { text: "TODOs Future + DNP", children: [{ text: "<%TODOFUTUREDNP%>" }] },
    { text: "TODOs Undated", children: [{ text: "<%TODOUNDATED%>" }] },
    {
      text: "Block Mentions List",
      children: [
        {
          text: "<%SET:ref,<%INPUT:Name of page or tag reference to search for?{page}%>%><%BLOCKMENTIONS:20,<%GET:ref%>%>",
        },
      ],
    },
    {
      text: "Search - plain text",
      children: [
        {
          text: "<%SET:text,<%INPUT:Text to search for?%>%><%SEARCH:<%GET:text%>%>",
        },
      ],
    },
    {
      text: "Workflow Smartblock Starter",
      children: [
        {
          text: "#SmartBlock <%INPUT:What is the name of the new workflow?%>",
          children: [{ text: "Edit workflow here" }],
        },
      ],
    },
    {
      text: "Button Smartblock Starter",
      children: [
        {
          text: "{{<%INPUT:What is the name of the caption of the button?%>:SmartBlock:<%INPUT:What is the name of the SmartBlock?%>}}",
        },
      ],
    },
  ] as InputTextNode[]
).map((s, i) => ({
  name: s.text,
  children: s.children,
  uid: PREDEFINED_REGEX.source.replace("\\d*", i.toString()),
}));

const predefinedChildrenByUid = Object.fromEntries(
  predefinedWorkflows.map((pw) => [pw.uid, pw.children])
);

export const HIDE_REGEX = /<%HIDE%>/i;

const customWorkflowsCache: {
  current?: { uid: string; name: string }[];
  timeout: number;
} = {
  current: undefined,
  timeout: 0,
};
export const getCustomWorkflows = () => {
  if (customWorkflowsCache.current) {
    window.clearTimeout(customWorkflowsCache.timeout);
    customWorkflowsCache.timeout = window.setTimeout(() => {
      customWorkflowsCache.current = undefined;
    }, 500);
    return customWorkflowsCache.current;
  }
  const result = (customWorkflowsCache.current = window.roamAlphaAPI.data.fast
    .q(
      `[:find
(pull ?r [:block/uid :block/string])
:where
  (or
    (and [?sb :node/title "SmartBlock"] [?r :block/refs ?sb])
    (and [?sb :node/title "42SmartBlock"] [?r :block/refs ?sb])
)]`
    )
    .map((r) => {
      const [block] = r as [PullBlock];
      return {
        uid: block?.[":block/uid"] || "",
        name: (block?.[":block/string"] || "")
          .replace(createTagRegex("SmartBlock"), "")
          .replace(createTagRegex("42SmartBlock"), "")
          .trim(),
      };
    }));
  customWorkflowsCache.timeout = window.setTimeout(() => {
    customWorkflowsCache.current = undefined;
  }, 500);
  return result;
};

export const getVisibleCustomWorkflows = () =>
  getCustomWorkflows()
    .filter(({ name }) => !HIDE_REGEX.test(name))
    .map(({ name, uid }) => ({
      uid,
      name: name.replace(HIDE_REGEX, ""),
    }));

export const getCleanCustomWorkflows = (workflows = getCustomWorkflows()) =>
  workflows.map(({ name, uid }) => ({
    uid,
    name: name.replace(/<%[A-Z]+%>/, "").trim(),
  }));

const getFormatter =
  (format: string, search: RegExp = /$^/) =>
  ({
    uid = "",
    text,
    title,
  }: {
    uid?: string;
    text?: string;
    title?: string;
  }) => ({
    text: format
      .replace(/{text(?::([^}]+))?}/g, (_, arg) => {
        const output = text || getTextByBlockUid(uid);
        if (!arg) return output;
        if (arg === "clean")
          return output.replace(new RegExp(search, "g"), "").trim();
        return output;
      })
      .replace(/{uid}/g, uid)
      .replace(/{page}/g, title || getPageTitleByBlockUid(uid))
      .replace(
        /{path}/g,
        getParentUidsOfBlockUid(uid)
          .reverse()
          .map((t, i) =>
            i === 0 ? `[[${getPageTitleByPageUid(t)}]]` : `((${t}))`
          )
          .join(" > ")
      )
      .replace(/{attr:([^}:]*)(?::([^}]*))?}/g, (_, name, format = "VALUE") => {
        const value = (
          (
            window.roamAlphaAPI.data.fast.q(
              `[:find (pull ?b [:block/string]) :where [?r :node/title "${normalizePageTitle(
                name
              )}"] [?t :block/uid "${uid}"] [?b :block/refs ?r] [?b :block/page ?p] [?t :block/page ?p]]]`
            ) as [PullBlock][]
          ).find((a) =>
            new RegExp(`^${name}::`).test(a?.[0]?.[":block/string"] || "")
          )?.[0]?.[":block/string"] || ""
        )
          .slice(name.length + 2)
          .trim();
        return value && format.replace("VALUE", value);
      }),
  });

const outputTodoBlocks = (
  blocks: { text: string; uid: string }[],
  limit = "20",
  format = "(({uid}))",
  ...search: string[]
) => {
  const outputtedBlocks = blocks
    .filter(({ text }) => !/{{(\[\[)?query(\]\])?/.test(text))
    .filter(({ text }) =>
      search.every((s) =>
        /^-/.test(s) ? !text.includes(s.substring(1)) : text.includes(s)
      )
    );
  const limitArg = Number(limit);
  if (limitArg === -1) return `${outputtedBlocks.length}`;
  return outputtedBlocks
    .slice(0, Number(limit))
    .map(getFormatter(format, createTagRegex("TODO")));
};

type CommandOutput = string | string[] | InputTextNode[];
export type CommandHandler = (
  ...args: string[]
) => CommandOutput | Promise<CommandOutput>;

export type SmartBlocksContext = {
  targetUid: string;
  triggerUid: string;
  ifCommand?: boolean;
  exitBlock: "yes" | "no" | "end" | "empty" | "childless";
  exitWorkflow: boolean;
  variables: Record<string, string>;
  cursorPosition?: { uid: string; selection: number };
  currentUid?: string;
  currentContent: string;
  indent: Set<string>;
  unindent: Set<string>;
  focusOnBlock?: string;
  refMapping: Record<string, string>;
  afterWorkflowMethods: (() => void | Promise<void>)[];
  illegalCommands: Set<string>;
};

export const smartBlocksContext: SmartBlocksContext = {
  targetUid: "",
  exitBlock: "no",
  exitWorkflow: false,
  variables: {},
  currentContent: "",
  indent: new Set(),
  unindent: new Set(),
  refMapping: {},
  afterWorkflowMethods: [],
  triggerUid: "",
  illegalCommands: new Set(),
};
const resetContext = (context: Partial<SmartBlocksContext> = {}) => {
  smartBlocksContext.triggerUid = context.triggerUid || context.targetUid || "";
  smartBlocksContext.targetUid = context.targetUid || "";
  smartBlocksContext.ifCommand = context.ifCommand || undefined;
  smartBlocksContext.exitBlock = context.exitBlock || "no";
  smartBlocksContext.exitWorkflow = context.exitWorkflow || false;
  smartBlocksContext.variables = context.variables || {};
  smartBlocksContext.cursorPosition = context.cursorPosition;
  smartBlocksContext.currentUid = context.currentUid;
  smartBlocksContext.focusOnBlock = context.focusOnBlock;
  smartBlocksContext.currentContent = context.currentContent || "";
  smartBlocksContext.indent = context.indent || new Set();
  smartBlocksContext.unindent = context.unindent || new Set();
  smartBlocksContext.refMapping = context.refMapping || {};
  smartBlocksContext.afterWorkflowMethods = context.afterWorkflowMethods || [];
  smartBlocksContext.illegalCommands = context.illegalCommands || new Set();
};

const formatTree = (
  { uid, children, text, ...rest }: InputTextNode,
  format: string
): InputTextNode => ({
  ...rest,
  children: (children || []).map((c) => formatTree(c, format)),
  text: getFormatter(format)({ uid, text }).text,
});

// TODO - move to roamjs-components
const stripUid = (n: InputTextNode[] = []): InputTextNode[] =>
  n.map(({ uid, children, ...c }) => ({
    ...c,
    children: stripUid(children),
  }));

export const COMMANDS: {
  text: string;
  help: string;
  delayArgs?: true;
  handler: CommandHandler;
  illegal?: true;
}[] = [
  {
    text: "DATE",
    help: "Returns a Roam formatted dated page reference.\n\n1: NLP expression\n\n2: optional: format for returned date, example: YYYY-MM-DD",
    handler: (nlp, ...format) => {
      if (!nlp) {
        return `[[${window.roamAlphaAPI.util.dateToPageTitle(
          parseNlpDate("today", getDateBasisDate())
        )}]]`;
      }
      const date =
        parseNlpDate(nlp, getDateBasisDate()) ||
        // chrono fails basic parsing requiring forward date if ambiguous
        // https://github.com/wanasit/chrono/commit/4f264a9f21fbd04eb740bf48f5616f6e6e0e78b7
        parseNlpDate(`in ${nlp}`, getDateBasisDate());
      if (!date) {
        return `Could not return a valid date with text "${nlp}"`;
      }
      if (format.length) {
        return datefnsFormat(date, format.join(","), {
          useAdditionalDayOfYearTokens: true,
          useAdditionalWeekYearTokens: true,
        });
      }
      return `[[${window.roamAlphaAPI.util.dateToPageTitle(date)}]]`;
    },
  },
  {
    text: "TIME",
    help: "Returns time in 24 hour format",
    handler: (nlp) => {
      const dt = nlp
        ? parseNlpDate(nlp, getDateBasisDate()) ||
          // chrono fails basic parsing requiring forward date if ambiguous
          // https://github.com/wanasit/chrono/commit/4f264a9f21fbd04eb740bf48f5616f6e6e0e78b7
          parseNlpDate(`in ${nlp}`, getDateBasisDate())
        : new Date();
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
    handler: (nlp) => {
      const dt = nlp
        ? parseNlpDate(nlp, getDateBasisDate()) ||
          // chrono fails basic parsing requiring forward date if ambiguous
          // https://github.com/wanasit/chrono/commit/4f264a9f21fbd04eb740bf48f5616f6e6e0e78b7
          parseNlpDate(`in ${nlp}`, getDateBasisDate())
        : new Date();
      const hours = dt.getHours();
      const minutes = dt.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      const hoursAm = hours % 12 || 12;
      const strTime =
        hoursAm.toString().padStart(2, "0") +
        ":" +
        minutes.toString().padStart(2, "0") +
        " " +
        ampm;
      return strTime;
    },
  },
  {
    text: "RANDOMBLOCK",
    help: "Returns random block from graph.",
    handler: () => {
      const uids = getAllBlockUids();
      const uid = uids[Math.floor(Math.random() * uids.length)];
      return `((${uid}))`;
    },
  },
  {
    text: "RANDOMBLOCKFROM",
    help: "Returns a random child block from a page or block ref\n\n1: Page name or UID.\n\n2: Levels Included\n\n3: Format",
    handler: (titleOrUid = "", levelsIncluded = "0", format = "(({uid}))") => {
      const uids = flattenUids(
        getLevelsBelowParentUid(titleOrUid, levelsIncluded)
      );
      const uid = uids[Math.floor(Math.random() * uids.length)];
      return uids.length
        ? getFormatter(format)({ uid }).text
        : "No blocks on page!";
    },
  },
  {
    text: "RANDOMBLOCKMENTION",
    help: "Returns random block where page ref mentioned\n\n1: Page name or UID",
    handler: (...args) => {
      const refUids = args
        .map((titleOrUid) => ({
          titleOrUid: titleOrUid.replace(/^-/, ""),
          excludes: /^-/.test(titleOrUid),
        }))
        .map(({ titleOrUid, excludes }) => {
          return {
            uid: getUidFromText(titleOrUid),
            excludes,
          };
        });
      if (!refUids.length) {
        return "Please include at least one page name or UID.";
      }
      const uids = window.roamAlphaAPI
        .q(
          `[:find ?u :where [?r :block/uid ?u] ${refUids
            .map(({ uid, excludes }, i) => {
              const mentions = `[?b${i} :block/uid "${uid}"] [?r :block/refs ?b${i}]`;
              return excludes ? `(not ${mentions})` : mentions;
            })
            .join(" ")}]`
        )
        .map((s) => s[0]);
      const uid = uids[Math.floor(Math.random() * uids.length)];
      return uids.length ? `((${uid}))` : "No uids found with these tags";
    },
  },
  {
    text: "RANDOMNUMBER",
    help: "Return a random number between two values.\n\n1: Min\n2:Max",
    handler: (min, max) => {
      return (
        Math.floor(Math.random() * (Number(max) - Number(min) + 1)) +
        parseInt(min)
      ).toString();
    },
  },
  {
    text: "RANDOMPAGE",
    help: "Returns random page from graph",
    handler: () => {
      const pages = getAllPageNames();
      const page = pages[Math.floor(Math.random() * pages.length)];
      return `[[${page}]]`;
    },
  },
  {
    text: "RANDOMCHILDOF",
    help: "Returns a random child block from a block references or page\n\n1: Page name or UID.",
    handler: (titleOrUid = "") => {
      const parentUid = getUidFromText(titleOrUid);
      const uids = window.roamAlphaAPI.data.fast
        .q(
          `[:find (pull ?c [:block/uid]) :where [?b :block/uid "${parentUid}"] [?r :block/refs ?b] [?c :block/parents ?r]]`
        )
        .map((r) => (r as [PullBlock])[0]?.[":block/uid"] as string);
      const uid = uids[Math.floor(Math.random() * uids.length)];
      return uids.length ? `((${uid}))` : "No blocks on page!";
    },
  },
  {
    text: "TODOTODAY",
    help: "Returns a list of block refs of TODOs for today\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const today = window.roamAlphaAPI.util.dateToPageTitle(
        parseNlpDate("today", getDateBasisDate())
      );
      const todos = window.roamAlphaAPI
        .q(
          `[:find ?u ?s :where 
            [?r :block/uid ?u] [?r :block/string ?s] 
              (or-join [?r ?d] 
                (and [?r :block/refs ?d]) 
                (and [?r :block/page ?d]) 
                (and [?r :block/parents ?c] [?c :block/refs ?d]) 
                (and [?c :block/refs ?d] [?c :block/parents ?r])
              ) 
            [?r :block/refs ?p] [?p :node/title "TODO"] [?d :node/title "${today}"]
        ]`
        )
        .map((r) => {
          const [uid, text] = r as [string, string];
          return { uid, text };
        });
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOOVERDUE",
    help: "Returns a list of block refs of TODOs that are Overdue\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = startOfDay(parseNlpDate("today", getDateBasisDate()));
      const todos = blocks
        .filter(({ text }) => DAILY_REF_REGEX.test(text))
        .map(({ text, uid }) => ({
          text,
          uid,
          date: window.roamAlphaAPI.util.pageTitleToDate(
            DAILY_REF_REGEX.exec(text)?.[1] || ""
          ),
        }))
        .filter(({ date }) => date && isBefore(date, today))
        .sort(
          ({ date: a }, { date: b }) =>
            (a?.valueOf() || 0) - (b?.valueOf() || 0)
        );
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOOVERDUEDNP",
    help: "Returns a list of block refs of TODOs that are Overdue including DNP TODOs\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = startOfDay(parseNlpDate("today", getDateBasisDate()));
      const todos = blocks
        .map(({ text, uid }) => ({
          text,
          uid,
          date: DAILY_REF_REGEX.exec(text)?.[1] || getPageTitleByBlockUid(uid),
        }))
        .filter(({ date }) =>
          new RegExp(`^${DAILY_NOTE_PAGE_REGEX.source}$`).test(date)
        )
        .map(({ text, uid, date }) => ({
          text,
          uid,
          date: window.roamAlphaAPI.util.pageTitleToDate(date),
        }))
        .filter(({ date }) => date && isBefore(date, today))
        .sort(
          ({ date: a }, { date: b }) =>
            (a?.valueOf() || 0) - (b?.valueOf() || 0)
        );
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOFUTURE",
    help: "Returns a list of block refs of TODOs that are due in the future\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = parseNlpDate("today", getDateBasisDate() || undefined);
      const todos = blocks
        .filter(({ text }) => DAILY_REF_REGEX.test(text))
        .map(({ text, uid }) => ({
          text,
          uid,
          date: window.roamAlphaAPI.util.pageTitleToDate(
            DAILY_REF_REGEX.exec(text)?.[1] || ""
          ),
        }))
        .filter(({ date }) => date && isAfter(date, today))
        .sort(
          ({ date: a }, { date: b }) =>
            (a?.valueOf() || 0) - (b?.valueOf() || 0)
        );
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOFUTUREDNP",
    help: "Returns a list of block refs of TODOs that are due in the future including DNP TODOs\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = parseNlpDate("today", getDateBasisDate());
      const todos = blocks
        .map(({ text, uid }) => ({
          text,
          uid,
          date: DAILY_REF_REGEX.exec(text)?.[1] || getPageTitleByBlockUid(uid),
        }))
        .filter(({ date }) =>
          new RegExp(`^${DAILY_NOTE_PAGE_REGEX.source}$`).test(date)
        )
        .map(({ text, uid, date }) => ({
          text,
          uid,
          date: window.roamAlphaAPI.util.pageTitleToDate(date),
        }))
        .filter(({ date }) => date && isAfter(date, today))
        .sort(
          ({ date: a }, { date: b }) =>
            (a?.valueOf() || 0) - (b?.valueOf() || 0)
        );
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOUNDATED",
    help: "Returns a list of block refs of TODOs with no date\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidTextAndPageReferencingTag("TODO");
      const todos = blocks
        .filter(
          ({ text, title }) =>
            !DAILY_REF_REGEX.test(text) &&
            !DAILY_NOTE_PAGE_TITLE_REGEX.test(title)
        )
        .sort(({ text: a }, { text: b }) => a.localeCompare(b));
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "INPUT",
    help: "Prompts user for input which will then be inserted into block\n\n1: text to display in prompt.\n2: A default value\n3+: Optional options for a select",
    handler: async (...args) => {
      const [display, initialValue, ...options] = args.join("%%").split("%%");
      return await renderPrompt({ display, initialValue, options });
    },
  },
  {
    text: "FORM",
    help: "Prompts the user for a series of inputs, which then will be inserted into a series of blocks\n\n1: Block reference to the form configuration",
    handler: async (uidOrVar = "") => {
      const blockUid = getUidFromText(uidOrVar);
      const [formConfig] = await processBlockUid(blockUid);
      if (!formConfig) return "";
      const fieldsConfig =
        (formConfig.children || []).find((s) =>
          toFlexRegex("fields").test(s.text.trim())
        )?.children || [];
      const fieldEntries = fieldsConfig.map((f) => {
        const fieldType = getSettingValueFromTree({
          tree: f.children,
          key: "type",
        });
        return [
          f.text,
          {
            type: fieldType,
            label: getSettingValueFromTree({
              tree: f.children,
              key: "label",
              defaultValue: f.text,
            }),
            options: getSettingValuesFromTree({
              tree: f.children || [],
              key: "options",
            }),
            conditional:
              getSettingValueFromTree({
                tree: f.children,
                key: "conditional",
              }) || undefined,
            conditionalValues: getSettingValuesFromTree({
              tree: f.children || [],
              key: "conditionalValues",
            }),
            defaultValue:
              getSettingValueFromTree({
                tree: f.children,
                key: "default",
              }) ||
              (fieldType === "embed" && smartBlocksContext.variables[f.text]
                ? [{ text: smartBlocksContext.variables[f.text] }]
                : undefined),
          } as Required<FormDialogProps>["fields"][string],
        ] as const;
      });
      const title =
        getTextByBlockUid(blockUid) ||
        getSettingValueFromTree({
          tree: formConfig.children,
          key: "title",
          defaultValue: "SmartBlocks Form",
        });
      const submitButtonText = getSettingValueFromTree({
        tree: formConfig.children,
        key: "submit",
        defaultValue: "Submit",
      });
      const cancelButtonText = getSettingValueFromTree({
        tree: formConfig.children,
        key: "cancel",
        defaultValue: "Cancel",
      });
      return new Promise<Record<string, unknown> | false>((resolve) =>
        renderFormDialog({
          fields: Object.fromEntries(fieldEntries),
          onSubmit: resolve,
          isOpen: true,
          onClose: () => resolve(false),
          title,
          submitButtonText,
          cancelButtonText,
        })
      ).then((values) => {
        if (!values) {
          return "false";
        }
        const outputMode = getSettingValueFromTree({
          tree: formConfig.children,
          key: "output",
          defaultValue: "inline",
        });
        const validFields = fieldEntries
          .map((t) => t[0])
          .filter((t) => typeof values[t] !== "undefined");
        const get = (key: string) => {
          const val = values[key];
          if (typeof val === "string") {
            return val;
          }
          if (typeof val === "object") {
            return JSON.stringify(val);
          }
          return `${val}`;
        };
        if (toFlexRegex("inline").test(outputMode)) {
          return validFields.map(get);
        } else if (toFlexRegex("variables").test(outputMode)) {
          validFields.forEach(
            (t) => (smartBlocksContext.variables[t] = get(t))
          );
          return "true";
        } else {
          return "true";
        }
      });
    },
  },
  {
    illegal: true,
    text: "JAVASCRIPT",
    help: "DEPRECATED",
    handler: () => {
      return "The JAVASCRIPT command is no longer available. Visit https://roamjs.com/extensions/smartblocks/migration_guide#1MPiDsoO- for help on how to migrate.";
    },
  },
  {
    illegal: true,
    text: "J",
    help: "DEPRECATED",
    handler: () => {
      return "The J command is no longer available. Visit https://roamjs.com/extensions/smartblocks/migration_guide#1MPiDsoO- for help on how to migrate.";
    },
  },
  {
    illegal: true,
    text: "JAVASCRIPTASYNC",
    help: "DEPRECATED",
    handler: () => {
      return "The JAVASCRIPTASYNC command is no longer available. Visit https://roamjs.com/extensions/smartblocks/migration_guide#1MPiDsoO- for help on how to migrate.";
    },
  },
  {
    illegal: true,
    text: "JA",
    help: "DEPRECATED",
    handler: () => {
      return "The JA command is no longer available. Visit https://roamjs.com/extensions/smartblocks/migration_guide#1MPiDsoO- for help on how to migrate.";
    },
  },
  {
    text: "ONBLOCKEXIT",
    illegal: true,
    help: "DEPRECATED",
    // no one used this command anyway...
    handler: () =>
      "The ONBLOCKEXIT command is no longer available. Visit https://roamjs.com/extensions/smartblocks/migration_guide#1MPiDsoO- for help on how to migrate.",
  },
  {
    text: "BREADCRUMBS",
    help: "Returns a list of parent block refs to a given block ref\n\n1: Block reference\n\n2: Separator used between block references",
    handler: (uidArg = "", ...delim) => {
      const separator = delim.join(",") || " > ";
      const uid = uidArg.replace(/^(\+|-)?\(\(/, "").replace(/\)\)$/, "");
      return [
        ...(uidArg.startsWith("-")
          ? []
          : [`[[${getPageTitleByBlockUid(uid)}]]`]),
        ...(uidArg.startsWith("+")
          ? []
          : getParentUidsOfBlockUid(uid)
              .reverse()
              .slice(1)
              .map((u) => `((${u}))`)),
      ].join(separator);
    },
  },
  {
    text: "CURRENTBLOCKCONTENT",
    help: "Sets a variable to the block UID for the current block\n\n1. Variable name",
    handler: (name = "") => {
      if (name) {
        smartBlocksContext.variables[name] = smartBlocksContext.currentContent;
        return "";
      }
      return smartBlocksContext.currentContent;
    },
  },
  {
    text: "TRIGGERBLOCKAUTHOR",
    help: "Sets a variable to the user display name for the triggered block\n\n1. Variable name",
    handler: (name = "") => {
      const user = window.roamAlphaAPI.pull("[:create/user]", [
        ":block/uid",
        smartBlocksContext.triggerUid,
      ])?.[":create/user"]?.[":db/id"];
      if (!user) return "";
      const displayPage = window.roamAlphaAPI.pull(
        "[:user/display-page]",
        user
      )?.[":user/display-page"]?.[":db/id"];
      if (!displayPage) return "";
      const username =
        window.roamAlphaAPI.pull("[:node/title :block/uid]", displayPage)?.[
          ":node/title"
        ] || "Anonymous";
      if (username) {
        smartBlocksContext.variables[name] = username;
        return "";
      }
      return username;
    },
  },
  {
    text: "CONCAT",
    help: "Combines a comma separated list of text into one. Handles references\n\n1: comma separated list",
    handler: (...args) => {
      return args.map((a) => getTextByBlockUid(extractRef(a)) || a).join("");
    },
  },
  {
    text: "CURRENTPAGENAME",
    help: "Returns the current page name the smart block is running in.",
    handler: (modeOrName) => {
      const title =
        getPageTitleByBlockUid(smartBlocksContext.targetUid) ||
        getPageTitleByPageUid(smartBlocksContext.targetUid);
      const pageName =
        modeOrName === "base" ? title.split("/").slice(-1)[0] : title;
      if (modeOrName && modeOrName !== "base") {
        smartBlocksContext.variables[modeOrName] = pageName;
        return "";
      }
      return pageName;
    },
  },
  {
    text: "RESOLVEBLOCKREF",
    help: "Convert block ref to text\n\n1. Block reference",
    handler: (uid = "") =>
      PAGE_TITLE_REGEX.exec(uid)?.[1] ||
      getTextByBlockUid(uid.replace(BLOCK_REF_REGEX, "$1")),
  },
  {
    text: "CURRENTUSER",
    help: "Return the display name of the current user",
    handler: () =>
      getDisplayNameByUid(getCurrentUserUid()) ||
      getCurrentUserDisplayName() ||
      "No Diplay Name for Current User",
  },
  {
    text: "CURRENTURL",
    help: "Return the current URL of the page",
    handler: () => window.location.href,
  },
  {
    text: "PAGEMENTIONS",
    help: "Returns list of pages that mention the input title\n\n1: Max blocks to return\n\n2: Page or Tag Name",
    handler: (limitArg = "20", ...search: string[]) => {
      const limit = Number(limitArg) || 20;
      const titles = window.roamAlphaAPI
        .q(
          `[:find ?t :where [?p :node/title ?t] ${search
            .map((s, i) => {
              const mentions = `[?b${i} :node/title "${normalizePageTitle(
                extractTag(s)
              )}"] [?r${i} :block/refs ?b${i}] [?r${i} :block/page ?p]`;
              return mentions;
            })
            .join(" ")}]`
        )
        .map((s) => s[0] as string);
      if (limit === -1) return `${titles.length}`;
      return titles
        .sort((a, b) => a.localeCompare(b))
        .slice(0, limit)
        .map((s) => `[[${s}]]`);
    },
  },
  {
    text: "BLOCKMENTIONS",
    help: "Returns list of blocks mentioned\n\n1: Max blocks to return\n\n2: Page or Tag Name\n\n3:Format of output.\n\n4: (opt) filtering",
    handler: (
      limitArg = "20",
      titleArg = "",
      format = "(({uid}))",
      ...search: string[]
    ) => {
      const limit = Number(limitArg);
      const title = extractTag(titleArg);
      const results = getBlockUidTextAndPageReferencingTag(title).filter(
        ({ text, title }) =>
          search.every((s) =>
            s.startsWith("*")
              ? !title.includes(s.substring(1))
              : s.startsWith("^")
              ? title.includes(s.substring(1))
              : s.startsWith("-")
              ? !text.includes(s.substring(1))
              : text.includes(s)
          )
      );
      if (limit === -1) return `${results.length}`;
      return results
        .sort((a, b) => a.text.localeCompare(b.text))
        .slice(0, limit)
        .map(getFormatter(format, createTagRegex(title)));
    },
  },
  {
    text: "BLOCKMENTIONSDATED",
    help: "Returns list of blocks mentioned based on date range\n\n1: Max blocks to return\n\n2: Page or Tag Name\n\n3: Start Date\n\n4: End Date\n\n5: Sort (ASC,DESC,NONE)\n\n6:Format of Output\n\n7: (opt) filtering ",
    handler: (
      limitArg = "20",
      titleArg = "",
      startArg = "",
      endArg = "",
      sort = "ASC",
      format = "(({uid}))",
      ...search: string[]
    ) => {
      const referenceDate = getDateBasisDate();
      const undated = startArg === "-1" && endArg === "-1";
      const start =
        !undated && startArg && startArg !== "0"
          ? startOfDay(parseNlpDate(startArg, referenceDate))
          : new Date(0);
      const end =
        !undated && endArg && endArg !== "0"
          ? endOfDay(parseNlpDate(endArg, referenceDate))
          : new Date(9999, 11, 31);
      const limit = Number(limitArg);
      const title = extractTag(titleArg);
      const results = getBlockUidTextAndPageReferencingTag(title)
        .filter(({ text, title }) => {
          const ref =
            DAILY_REF_REGEX.exec(text)?.[1] ||
            DAILY_NOTE_PAGE_TITLE_REGEX.exec(title)?.[0];
          if (ref) {
            const d = window.roamAlphaAPI.util.pageTitleToDate(ref);
            return d && !undated && !isBefore(d, start) && !isAfter(d, end);
          } else {
            return undated;
          }
        })
        .filter(({ text }) =>
          search.every((s) =>
            s.startsWith("-")
              ? !text.includes(s.substring(1))
              : text.includes(s)
          )
        );
      if (limit === -1) return `${results.length}`;
      return results
        .sort(
          sort === "NONE"
            ? (a, b) => a.text.localeCompare(b.text)
            : sort === "DESC"
            ? (a, b) =>
                (getDateFromBlock(b)?.valueOf() || 0) -
                (getDateFromBlock(a)?.valueOf() || 0)
            : (a, b) =>
                (getDateFromBlock(a)?.valueOf() || 0) -
                (getDateFromBlock(b)?.valueOf() || 0)
        )
        .slice(0, limit)
        .map(getFormatter(format, createTagRegex(title)));
    },
  },
  {
    illegal: true,
    text: "IF",
    help: "DEPRECATED",
    handler: () => {
      return "The IF command is no longer available. Visit https://roamjs.com/extensions/smartblocks/migration_guide#1MPiDsoO- for help on how to migrate.";
    },
  },
  {
    illegal: true,
    text: "THEN",
    delayArgs: true,
    help: "DEPRECATED",
    handler: () => {
      return "The THEN command is no longer available. Visit https://roamjs.com/extensions/smartblocks/migration_guide#1MPiDsoO- for help on how to migrate.";
    },
  },
  {
    illegal: true,
    text: "ELSE",
    help: "DEPRECATED",
    handler: () => {
      return "The ELSE command is no longer available. Visit https://roamjs.com/extensions/smartblocks/migration_guide#1MPiDsoO- for help on how to migrate.";
    },
  },
  {
    illegal: true,
    text: "IFTRUE",
    help: "DEPRECATED",
    handler: () => {
      return "The IFTRUE command is no longer available. Visit https://roamjs.com/extensions/smartblocks/migration_guide#1MPiDsoO- for help on how to migrate.";
    },
  },
  {
    text: "IFDATEOFYEAR",
    help: "Compares today's date\n\n1: Comma separated list of dates (mm/dd)\nExample: 01/01,04/01,09/01",
    handler: (...dates) => {
      const today = parseNlpDate("today", getDateBasisDate());
      const match = dates
        .map((d) => d.trim())
        .some((d) => {
          const parts = d.split("/");
          const monthPart = Number(parts[0]);
          const dayPart = Number(parts[1]);
          return (
            today.getMonth() + 1 === monthPart && today.getDate() === dayPart
          );
        });
      if (!match) {
        smartBlocksContext.exitBlock = "yes";
      }
      return "";
    },
  },
  {
    text: "IFDAYOFMONTH",
    help: "Compares today's date\n\n1: Comma separated list of days\n Example: 5,10,15",
    handler: (...dates) => {
      const today = parseNlpDate("today", getDateBasisDate());
      const match = dates
        .map((s) => s.trim())
        .map((s) => Number(s))
        .includes(today.getDate());
      if (!match) {
        smartBlocksContext.exitBlock = "yes";
      }
      return "";
    },
  },
  {
    text: "IFDAYOFWEEK",
    help: "Compares today's date\n\n1: Comma separated list of days of week. 1 is Monday, 7 is Sunday\nExample: 1,3",
    handler: (...dates) => {
      const today = parseNlpDate("today", getDateBasisDate());
      const match = dates
        .map((s) => s.trim())
        .map((s) => Number(s) % 7)
        .includes(today.getDay());
      if (!match) {
        smartBlocksContext.exitBlock = "yes";
      }
      return "";
    },
  },
  {
    text: "IFTAGINBLOCK",
    help: "Compares whether the page name or id in the first argument is in the block referenced by the second argument.\n\n1. Page by title or id\n\n2. Block reference",
    handler: (pageOrUid = "", blockUid = "") => {
      const uid =
        getPageUidByPageTitle(extractTag(pageOrUid)) || extractRef(pageOrUid);
      const present = !!window.roamAlphaAPI.q(
        `[:find ?b :where [?p :block/uid "${uid}"] [?b :block/refs ?p] [?b :block/uid "${blockUid}"]]`
      )[0]?.[0];
      if (!present) {
        smartBlocksContext.exitBlock = "yes";
      }
      return "";
    },
  },
  {
    text: "IFCHILDREN",
    help: "Compares whether the current block produced children, and if not, skips.",
    handler: () => {
      smartBlocksContext.exitBlock = "childless";
      return "";
    },
  },
  {
    text: "IFVAR",
    help: "Compares the variable with a given value. If the test fails, the block is skipped.\n\n1. Variable name\n\n2. Value or Regular Expression",
    handler: (name = "", ...exp) => {
      const actual = smartBlocksContext.variables[name];
      if (typeof actual === "undefined") {
        if (exp.length > 0) {
          smartBlocksContext.exitBlock = "yes";
          return "";
        } else {
          return "";
        }
      }
      const expected = exp.join(",");
      if (expected.startsWith("/") && expected.endsWith("/")) {
        if (new RegExp(expected.slice(1, -1)).test(actual)) {
          return "";
        }
      } else if (actual === expected) {
        return "";
      }
      smartBlocksContext.exitBlock = "yes";
      return "";
    },
  },
  {
    text: "IFNOTVAR",
    help: "Compares the variable with a given value. If the test succeeds, the block is skipped.\n\n1. Variable name\n\n2. Value or Regular Expression",
    handler: (name = "", ...exp) => {
      const actual = smartBlocksContext.variables[name];
      if (typeof actual === "undefined") {
        if (exp.length > 0) {
          return "";
        } else {
          smartBlocksContext.exitBlock = "yes";
          return "";
        }
      }
      const expected = exp.join(",");
      if (expected.startsWith("/") && expected.endsWith("/")) {
        if (!new RegExp(expected.slice(1, -1)).test(actual)) {
          return "";
        }
      } else if (actual !== expected) {
        return "";
      }
      smartBlocksContext.exitBlock = "yes";
      return "";
    },
  },
  {
    text: "IFMATCH",
    help: "Compares the first argument with the second. If the test fails, the block is skipped.\n\n1. Variable name or value\n\n2. Variable name, value or Regular Expression",
    handler: (name = "", ...exp) => {
      const actual = smartBlocksContext.variables[name] || name;
      const expectedArg = exp.join(",");
      const expected = smartBlocksContext.variables[expectedArg] || expectedArg;
      if (expected.startsWith("/") && expected.endsWith("/")) {
        if (new RegExp(expected.slice(1, -1)).test(actual)) {
          return "";
        }
      } else if (actual === expected) {
        return "";
      }
      smartBlocksContext.exitBlock = "yes";
      return "";
    },
  },
  {
    text: "IFNOTMATCH",
    help: "Compares the first argument with the second. If the test succeeds, the block is skipped.\n\n1. Variable name or value\n\n2. Variable name, value or Regular Expression",
    handler: (name = "", ...exp) => {
      const actual = smartBlocksContext.variables[name] || name;
      const expectedArg = exp.join(",");
      const expected = smartBlocksContext.variables[expectedArg] || expectedArg;
      if (expected.startsWith("/") && expected.endsWith("/")) {
        if (!new RegExp(expected.slice(1, -1)).test(actual)) {
          return "";
        }
      } else if (actual !== expected) {
        return "";
      }
      smartBlocksContext.exitBlock = "yes";
      return "";
    },
  },
  {
    text: "GET",
    help: "Returns a variable\n\n1. Variable name\n\n2. Mode: 'normal', 'split', or 'json'",
    handler: (name = "", mode = "normal") => {
      if (!name) return "--> Variable name required for GET <--";
      return typeof smartBlocksContext.variables[name] === "undefined"
        ? `--> Variable ${name} not SET <--`
        : mode === "split"
        ? smartBlocksContext.variables[name].split(",")
        : mode === "json"
        ? stripUid(
            JSON.parse(smartBlocksContext.variables[name]) as InputTextNode[]
          )
        : smartBlocksContext.variables[name];
    },
  },
  {
    text: "SET",
    help: "Create a variable in memory\n\n1. Variable name\n\n2: Value of variable",
    handler: (name = "", ...value) => {
      smartBlocksContext.variables[name] = value.join(",");
      return "";
    },
  },
  {
    text: "HAS",
    help: "Checks if a variable is defined within the SmartBlock workflow\n\n1. Variable name",
    handler: (name = "") => {
      return `${typeof smartBlocksContext.variables[name] !== "undefined"}`;
    },
  },
  {
    text: "CLEARVARS",
    help: "Clears all variables from memory",
    handler: () => {
      smartBlocksContext.variables = {};
      return "";
    },
  },
  {
    text: "CURSOR",
    help: "Defines where cursor should be located after the workflow completes.",
    handler: () => {
      smartBlocksContext.cursorPosition = {
        uid: smartBlocksContext.currentUid || "",
        selection: smartBlocksContext.currentContent.length,
      };
      return "";
    },
  },
  {
    text: "TRIGGERREF",
    help: "Sets a variable to the block UID for the block that triggered the workflow\n\n1. Variable name\n\n2. Set to false for no formatting",
    handler: (name = "", format = "true") => {
      const ref =
        format === "true"
          ? `((${smartBlocksContext.triggerUid}))`
          : smartBlocksContext.triggerUid;
      if (name) {
        smartBlocksContext.variables[name] = ref;
        return "";
      }
      return ref;
    },
  },
  {
    text: "CURRENTBLOCKREF",
    help: "Sets a variable to the block UID for the current block\n\n1. Variable name\n\n2. Set to false for no formatting",
    handler: (name = "", format = "true") => {
      const ref =
        format === "true"
          ? `((${smartBlocksContext.currentUid}))`
          : smartBlocksContext.currentUid || "";
      if (name.trim()) {
        smartBlocksContext.variables[name.trim()] = ref;
        return "";
      }
      return ref;
    },
  },
  {
    text: "PARENT",
    help: "Return the block UID that is the parent of the input block\n\n1. Block ref or uid\n\n2. Variable name\n\n3. Set to false for no formatting",
    handler: (child = "", name = "", format = "true") => {
      const blockUid = extractRef(smartBlocksContext.variables[child] || child);
      const parentRef = getParentUidByBlockUid(blockUid);
      const ref = format === "true" ? `((${parentRef}))` : parentRef;
      if (name.trim()) {
        smartBlocksContext.variables[name.trim()] = ref;
        return "";
      }
      return ref;
    },
  },
  {
    text: "INDENT",
    help: "Indents the current block if indentation can be done at current block. ",
    handler: () => {
      smartBlocksContext.indent.add(smartBlocksContext.currentUid || "");
      return "";
    },
  },
  {
    text: "UNINDENT",
    help: "Unidents at the current block if it can be done at current block. ",
    handler: () => {
      smartBlocksContext.unindent.add(smartBlocksContext.currentUid || "");
      return "";
    },
  },
  {
    text: "FOCUSONBLOCK",
    help: "Will focus on the current block after the workflow finshes. ",
    handler: () => {
      smartBlocksContext.focusOnBlock = smartBlocksContext.currentUid;
      return "";
    },
  },
  {
    text: "EXIT",
    help: "Stops the workflow from going further after completing the current block",
    handler: () => {
      smartBlocksContext.exitWorkflow = true;
      return "";
    },
  },
  {
    text: "NOTIFICATION",
    help: "Displays notification window\n\n1: Seconds\n\n2: Message\n\n3: Position",
    handler: (timeoutArg, ...contentArgs) => {
      const positionArg = contentArgs.slice(-1)[0];
      const isValid = ["top", "bottom"]
        .flatMap((t) => ["", " left", " right"].map((o) => `${t}${o}`))
        .includes(positionArg);
      const position = isValid
        ? (positionArg.replace(" ", "-") as ToasterPosition)
        : "top";
      const content = (isValid ? contentArgs.slice(0, -1) : contentArgs).join(
        ","
      );
      const timeout = (Math.max(Number(timeoutArg), 0) || 1) * 1000;
      renderToast({
        id: "smartblocks-notification",
        timeout,
        content,
        position,
      });
      return "";
    },
  },
  {
    text: "NOBLOCKOUTPUT",
    help: "Enforces no content output from a block",
    handler: () => {
      smartBlocksContext.exitBlock = "end";
      return "";
    },
  },
  {
    text: "SKIPIFEMPTY",
    help: "If a block's content is empty, skip it",
    handler: () => {
      smartBlocksContext.exitBlock = "empty";
      return "";
    },
  },
  {
    text: "SEARCH",
    help: "Search all blocks for string of text\n\n1: Max blocks to return<br/>2: String for search (case-sensitive)<br/>3: (opt) filtering ",
    handler: (limitArg = "20", format = "(({uid}))", ...search: string[]) => {
      if (!search.length) {
        return "";
      }
      const limit = Number(limitArg);
      const [first, ...rest] = search.map(extractTag);
      const results = getBlockUidAndTextIncludingText(first).filter(
        ({ text }) =>
          rest.every((s) =>
            s.startsWith("-")
              ? !text.includes(s.substring(1))
              : text.includes(s)
          )
      );
      if (limit === -1) return `${results.length}`;
      return results
        .sort((a, b) => a.text.localeCompare(b.text))
        .slice(0, limit)
        .map(getFormatter(format, new RegExp(`(${search.join("|")})`)));
    },
  },
  {
    text: "FLOOR",
    help: "Returns the input value rounded down\n1: An number to floor.",
    handler: (arg) =>
      Math.floor(
        Number(smartBlocksContext.variables[arg]) || Number(arg) || 0
      ).toString(),
  },
  {
    text: "ROUND",
    help: "Returns the input value rounded\n1: An number to round.",
    handler: (arg) =>
      Math.round(
        Number(smartBlocksContext.variables[arg]) || Number(arg) || 0
      ).toString(),
  },
  {
    text: "SUM",
    help: "Add all of the parameters together\n1: An addend to sum.",
    handler: (...args) =>
      args.reduce((a, b) => {
        const isADate = DAILY_NOTE_PAGE_REGEX.test(extractTag(a));
        const isBDate = DAILY_NOTE_PAGE_REGEX.test(extractTag(b));
        if (isADate && isBDate) {
          return b;
        } else if (isADate) {
          return window.roamAlphaAPI.util.dateToPageTitle(
            addDays(
              window.roamAlphaAPI.util.pageTitleToDate(extractTag(a)) ||
                new Date(),
              Number(b) || 0
            )
          );
        } else if (isBDate) {
          return window.roamAlphaAPI.util.dateToPageTitle(
            addDays(
              window.roamAlphaAPI.util.pageTitleToDate(extractTag(b)) ||
                new Date(),
              Number(a) || 0
            )
          );
        } else {
          return ((Number(a) || 0) + (Number(b) || 0)).toString();
        }
      }, "0"),
  },
  {
    text: "DIFFERENCE",
    help: "Find the difference between two parameters\n1: The minuend. 2: The subtrahend.",
    handler: (minuend = "0", subtrahend = "0") => {
      const isMinDate = DAILY_NOTE_PAGE_REGEX.test(extractTag(minuend));
      const isSubDate = DAILY_NOTE_PAGE_REGEX.test(extractTag(subtrahend));
      if (isMinDate && isSubDate) {
        return differenceInDays(
          window.roamAlphaAPI.util.pageTitleToDate(extractTag(minuend)) ||
            new Date(),
          window.roamAlphaAPI.util.pageTitleToDate(extractTag(subtrahend)) ||
            new Date()
        ).toString();
      } else if (isMinDate) {
        return window.roamAlphaAPI.util.dateToPageTitle(
          subDays(
            window.roamAlphaAPI.util.pageTitleToDate(extractTag(minuend)) ||
              new Date(),
            Number(subtrahend) || 0
          )
        );
      } else if (isSubDate) {
        return window.roamAlphaAPI.util.dateToPageTitle(
          subDays(
            window.roamAlphaAPI.util.pageTitleToDate(extractTag(subtrahend)) ||
              new Date(),
            Number(minuend) || 0
          )
        );
      } else {
        return ((Number(minuend) || 0) - (Number(subtrahend) || 0)).toString();
      }
    },
  },
  {
    text: "PRODUCT",
    help: "Multiplies all of the parameters together\n1: An factor to multiply.",
    handler: (...args) =>
      args.reduce((a, b) => a * (Number(b) || 0), 1).toString(),
  },
  {
    text: "DIVISION",
    help: "Find the quotient between two parameters\n1: The dividend. 2: The divisor.",
    handler: (dividend = "0", divisor = "1") =>
      Number(divisor) === 0
        ? "Infinity"
        : ((Number(dividend) || 0) / (Number(divisor) || 1)).toString(),
  },
  {
    text: "CLIPBOARDCOPY",
    help: "Writes text to the clipboard\n\n1: text",
    handler: (text = "") => {
      navigator.clipboard.writeText(text);
      return "";
    },
  },
  {
    text: "CLIPBOARDPASTETEXT",
    help: "Pastes from the clipboard",
    handler: async (...args) => {
      const settings = new Set(args);
      const raw = await navigator.clipboard.readText();
      const postTrim = settings.has("trim") ? raw.trim() : raw;
      const postCarriageOne = settings.has("nocarriagereturn")
        ? postTrim.replace(/\r\n/g, "")
        : postTrim;
      const postCarriage = settings.has("returnasspace")
        ? postCarriageOne.replace(/(\r)?\n(\r)?/g, " ")
        : postTrim;
      const postHyphens = settings.has("nohyphens")
        ? postCarriage.replace(/- /g, "")
        : postCarriage;
      const postSpaces = settings.has("noextraspaces")
        ? postHyphens.replace(/\s\s+/g, " ")
        : postHyphens;
      const postSplit = settings.has("split")
        ? postSpaces.split(/(?:\r)?\n/)
        : [postSpaces];
      return postSplit;
    },
  },
  {
    text: "SMARTBLOCK",
    help: "Runs another SmartBlock\n\n1. SmartBlock name\n\n2. Optional page name or ref to execute the workflow remotely",
    handler: (inputName = "", ...pageNameOrUid) => {
      const srcUid = getCleanCustomWorkflows().find(
        ({ name }) => name === inputName.trim()
      )?.uid;
      if (srcUid) {
        if (pageNameOrUid.length) {
          const title = extractTag(pageNameOrUid.join(","));
          const targetUid = getUidFromText(title);
          return (
            targetUid ? Promise.resolve(targetUid) : createPage({ title })
          ).then((targetUid) => {
            const parentContext = { ...smartBlocksContext };
            return sbBomb({
              srcUid,
              target: { uid: targetUid, isParent: true },
              variables: smartBlocksContext.variables,
            }).then((uid) => {
              resetContext(parentContext);
              return uid ? `((${uid}))` : "";
            });
          });
        }
        const nodes = getFullTreeByParentUid(srcUid).children;
        const parentContext = { ...smartBlocksContext };
        resetContext({
          variables: parentContext.variables,
          triggerUid: parentContext.triggerUid,
          // `currentUid` doesn't exist yet, so can't do queries based off of it
          targetUid: parentContext.targetUid,
        });
        return processChildren({
          nodes,
          introUid: parentContext.currentUid,
          introContent: parentContext.currentContent,
        }).then((nodes) => {
          resetContext({
            ...parentContext,
            refMapping: {
              ...parentContext.refMapping,
              ...smartBlocksContext.refMapping,
            },
            variables: smartBlocksContext.variables,
            cursorPosition: smartBlocksContext.cursorPosition,
          });
          return nodes;
        });
      } else {
        return inputName.trim();
      }
    },
  },
  {
    text: "REPEAT",
    delayArgs: true,
    help: "Repeats the current block a number of specified times\n\n1. Number of times for repeat",
    handler: (repeatArg = "1", content = "") =>
      proccessBlockText(repeatArg)
        .then(([{ text }]) =>
          Array(Number(text) || 1)
            .fill(content)
            .map((s) => () => proccessBlockText(s))
            .reduce(
              (prev, cur) =>
                prev.then((p) =>
                  cur().then((c) => {
                    return [...p, c];
                  })
                ),
              Promise.resolve([] as InputTextNode[][])
            )
        )
        .then((s) => s.flatMap((c) => c)),
  },
  {
    text: "DATEBASIS",
    help: "Time machine mode\n\n1: Date basis for date commands\nDNP for daily page\nNLP for other dates\nDefaults to TODAY at start of each workflow.",
    handler: (mode = "DNP") => {
      smartBlocksContext.variables["DATEBASISMETHOD"] =
        mode === "DNP" ? mode : parseNlpDate(mode, getDateBasisDate()).toJSON();
      return "";
    },
  },
  {
    text: "ATTRIBUTE",
    help: "Returns the arguments as a Roam attribute, so that your workflow definition doesn't create a reference.",
    handler: (...args: string[]) => `${args.join(",")}::`,
  },
  {
    text: "GETATTRIBUTE",
    help: "Returns the attribute value nested under the input block with a given input name.\n\n1. Page name or block ref\n\n2. The name of the attribute to fetch.",
    handler: (block, name) => {
      const uid = getUidFromText(block);
      return getAttributeValueByBlockAndName({ uid, name });
    },
  },
  {
    text: "HASHTAG",
    help: "Returns the arguments as a Roam hashtag, so that your workflow definition doesn't create a reference.",
    handler: (...args: string[]) => {
      const tag = args.join(",");
      return /[\s,]/.test(tag) ? `#[[${tag}]]` : `#${tag}`;
    },
  },
  {
    text: "TAG",
    help: "Returns the arguments as a Roam tag, so that your workflow definition doesn't create a reference.",
    handler: (...args: string[]) => `[[${args.join(",")}]]`,
  },
  {
    text: "BUTTON",
    help: "Returns the arguments as a Roam button, so that your workflow definition doesn't create a button.",
    handler: (...args: string[]) => `{{${args.join(",")}}}`,
  },
  {
    text: "OPENPAGE",
    help: "Opens or creates a page or block ref\n\n1. Page name or block ref\n\n2. A behavior to perform after navigating.",
    handler: (...args) => {
      const blockNumberArg =
        args.length > 1 && args[args.length - 1].includes("GOTOBLOCK")
          ? args[args.length - 1]
          : undefined;
      const pageOrUidArg = (blockNumberArg ? args.slice(0, -1) : args)
        .join(",")
        .trim();
      const uid = getUidFromText(pageOrUidArg);
      const refsToCreate = new Set(
        Object.values(smartBlocksContext.refMapping)
      );
      return (
        !getPageTitleByPageUid(uid) &&
        !getTextByBlockUid(uid) &&
        !refsToCreate.has(uid)
          ? createPage({
              title: smartBlocksContext.variables[pageOrUidArg] || pageOrUidArg,
            })
          : Promise.resolve(uid)
      ).then((navUid) => {
        const navToPage = () =>
          window.roamAlphaAPI.ui.mainWindow
            .openBlock({
              block: { uid: navUid },
            })
            .then(() => {
              if (typeof blockNumberArg === "string") {
                const blockNumber =
                  Number(blockNumberArg.replace(/GOTOBLOCK/, "").trim()) || 1;
                const blocks = Array.from(
                  document.querySelectorAll<HTMLDivElement>(
                    ".roam-article .rm-level-0 .rm-block-text"
                  )
                );
                const index =
                  blockNumber > 0
                    ? blockNumber - 1
                    : blocks.length + blockNumber;
                if (index >= 0 && index < blocks.length) {
                  const { blockUid } = getUids(blocks[index]);
                  window.roamAlphaAPI.ui.setBlockFocusAndSelection({
                    location: {
                      "block-uid": blockUid,
                      "window-id": `${getCurrentUserUid()}-body-outline-${getPageUidByBlockUid(
                        blockUid
                      )}`,
                    },
                  });
                }
              }
            });
        if (refsToCreate.has(navUid)) {
          smartBlocksContext.afterWorkflowMethods.push(navToPage);
          return "";
        } else {
          return navToPage().then(() => "");
        }
      });
    },
  },
  {
    text: "OPENREFERENCESINSIDEBAR",
    help: "Opens all of the blocks referencing a page or block in sidebar\n\n1. Page name or block ref",
    handler: (...args) => {
      const pageOrUidArg = args.join(",").trim();
      const pageOrUid =
        smartBlocksContext.variables[pageOrUidArg] || pageOrUidArg;
      const uid =
        getPageUidByPageTitle(extractTag(pageOrUid)) || extractRef(pageOrUid);
      const blocks = getBlockUidsReferencingBlock(uid);
      const windows = new Set(
        window.roamAlphaAPI.ui.rightSidebar
          .getWindows()
          .filter((w) => w.type === "block")
          .map((w) => w.type === "block" && w["block-uid"])
      );
      blocks.forEach(
        (blockUid) =>
          !windows.has(blockUid) &&
          window.roamAlphaAPI.ui.rightSidebar.addWindow({
            window: {
              type: "block",
              "block-uid": blockUid,
            },
          })
      );
      window.roamAlphaAPI.ui.rightSidebar.open();
      return "";
    },
  },
  {
    text: "SIDEBARWINDOWOPEN",
    help: "Opens or creates a page in the sidebar\n\n1. Page name or block ref",
    handler: (...args) => {
      const afterNavArg =
        args.length > 1 &&
        ["GOTOBLOCK", "GRAPH"].some((s) => args[args.length - 1].includes(s))
          ? args[args.length - 1]
          : undefined;
      const pageOrUidArgs = (afterNavArg ? args.slice(0, -1) : args).map((s) =>
        s.trim()
      );
      const pageOrUids = pageOrUidArgs
        .map(
          (pageOrUidArg) =>
            smartBlocksContext.variables[pageOrUidArg] || pageOrUidArg
        )
        .filter(Boolean);
      const uids = pageOrUids.map((pageOrUid) => ({
        uid:
          getPageUidByPageTitle(extractTag(pageOrUid)) || extractRef(pageOrUid),
        pageOrUid,
      }));
      const refsToCreate = new Set(
        Object.values(smartBlocksContext.refMapping)
      );
      return Promise.all(
        uids.map(({ uid, pageOrUid }) =>
          (!getPageTitleByPageUid(uid) &&
          !getTextByBlockUid(uid) &&
          !refsToCreate.has(uid)
            ? createPage({ title: pageOrUid })
            : Promise.resolve(uid)
          ).then((navUid) => {
            const openInSidebar = () =>
              window.roamAlphaAPI.ui.rightSidebar.open().then(() => {
                if (afterNavArg && /GRAPH/.test(afterNavArg)) {
                  return window.roamAlphaAPI.ui.rightSidebar.addWindow({
                    window: { type: "graph", "block-uid": navUid },
                  });
                } else if (afterNavArg && /GOTOBLOCK/.test(afterNavArg)) {
                  const blockNumber =
                    Number(afterNavArg.replace(/GOTOBLOCK/, "").trim()) || 1;
                  const blocks = Array.from(
                    document.querySelectorAll<HTMLDivElement>(
                      ".sidebar-content>div:first-child .rm-block-text"
                    )
                  );
                  const index =
                    blockNumber > 0
                      ? blockNumber - 1
                      : blocks.length + blockNumber;
                  if (index >= 0 && index < blocks.length) {
                    const { blockUid } = getUids(blocks[index]);
                    const windowId =
                      window.roamAlphaAPI.ui.rightSidebar.getWindows()[0][
                        "window-id"
                      ];
                    return window.roamAlphaAPI.ui.setBlockFocusAndSelection({
                      location: {
                        "window-id": windowId,
                        "block-uid": blockUid,
                      },
                    });
                  }
                } else {
                  return window.roamAlphaAPI.ui.rightSidebar.addWindow({
                    window: { type: "block", "block-uid": navUid },
                  });
                }
              });
            if (refsToCreate.has(navUid)) {
              smartBlocksContext.afterWorkflowMethods.push(openInSidebar);
            } else {
              openInSidebar();
            }
            return "";
          })
        )
      ).then(() => "");
    },
  },
  {
    text: "SIDEBARWINDOWCLOSE",
    help: "Closes sidebar pane\n\n1. number of side pane to close. Use 0 to close all panes.",
    handler: (numberArg = "0") => {
      const count = Number(numberArg) || 0;
      const windows = window.roamAlphaAPI.ui.rightSidebar.getWindows();
      if (count <= 0) {
        return Promise.all(
          windows.map((w) =>
            window.roamAlphaAPI.ui.rightSidebar.removeWindow({
              // @ts-ignore broken api
              window: w,
            })
          )
        )
          .then(() => window.roamAlphaAPI.ui.rightSidebar.close())
          .then(() => "");
      } else if (count <= windows.length) {
        return window.roamAlphaAPI.ui.rightSidebar
          .removeWindow({
            // @ts-ignore broken api
            window: windows[count],
          })
          .then(() => "");
      }
      return "";
    },
  },
  {
    text: "SIDEBARSTATE",
    help: "Toggles state of sidebars\n\nValue of  1 to 4. \n1 - open left sidebar \n\n2 - close left side bar \n\n3 - open right side bar \n\n4 - close right side bar.",
    handler: (stateArg = "1") => {
      const state = Number(stateArg) || 1;
      const leftButton = document.querySelector(".rm-open-left-sidebar-btn");
      switch (state) {
        case 1:
          return window.roamAlphaAPI.ui.leftSidebar.open().then(() => "");
        case 2:
          return window.roamAlphaAPI.ui.leftSidebar.close().then(() => "");
        case 3:
          return window.roamAlphaAPI.ui.rightSidebar.open().then(() => "");
        case 4:
          return window.roamAlphaAPI.ui.rightSidebar.close().then(() => "");
        default:
          return `Invalid Sidebar State: ${stateArg}`;
      }
    },
  },
  {
    text: "REPLACE",
    help: "Returns the text in the first argument after replacing one sub text with another. If the first argument is a block ref, replaces the block text in that ref instead. If the first argument is a variable, replace with that variable's value.\n\n1. Source text\n\n2.Text to replace\n\n3.Text to replace with",
    handler: (text = "", reg = "", out = "", flags = "") => {
      const normText = smartBlocksContext.variables[text] || text;
      const normOut = smartBlocksContext.variables[out] || out;
      const uid = extractRef(normText);
      const blockText = getTextByBlockUid(uid);
      const regex = /^`(.*?)`$/.test(reg)
        ? new RegExp(reg.slice(1, -1), flags)
        : new RegExp(
            reg,
            // TODO - this logic got too complicated and doesn't solve the intended problem - need a better solution
            // for whatever this was trying to solve: https://github.com/RoamJS/smartblocks/commit/f0519b666aab52af4b3c5fb6a7ed766052da7aca
            //
            // .replace(/([.+*?^$()[\]{}|\\])/g, (_, cap, ind) =>
            //   ind === 0 || reg[ind - 1] !== "\\" ? `\\${cap}` : cap
            // )
            flags
          );
      if (blockText) {
        return updateBlock({
          uid,
          text: blockText.replace(regex, normOut),
        }).then(() => "");
      }
      return normText.replace(regex, normOut);
    },
  },
  {
    text: "UPDATEBLOCK",
    help: "Updates the block referenced by the first argument with the text in the rest.\n\n1. Block reference\n\n2. Text to update with",
    handler: (ref = "", ...rest) => {
      const uid = getUidFromText(ref);
      const text = rest.join(",");
      const normOut = smartBlocksContext.variables[text] || text;
      return updateBlock({ uid, text: normOut }).then(() => "");
    },
  },
  {
    text: "UPDATEPAGE",
    help: "Updates the page title from the first argument to the second\n\n1. Block reference\n\n2. Text to update with",
    handler: (from = "", title = "") => {
      const uid = getPageUidByPageTitle(from);
      return uid
        ? window.roamAlphaAPI
            .updatePage({ page: { title, uid } })
            .then(() => "")
        : `Could not find page titled ${from}`;
    },
  },
  {
    text: "APIGET",
    help: "Sends an API request with the GET method to fetch data from a third party\n\n1. URL\n\n2. Optional field from response data",
    handler: (url = "", field = "") => {
      const output = (s: string | unknown) =>
        typeof s === "undefined"
          ? ""
          : typeof s === "string"
          ? s
          : JSON.stringify(s);
      return apiGet({ href: url, path: "", anonymous: true })
        .then((r) => {
          if (field) {
            return output(lodashGet(r, field.trim()));
          }
          return output(r);
        })
        .catch((e) => `Error: ${e.message}`);
    },
  },
  {
    text: "CHILDREN",
    help: "Gets the block tree nested under the input block reference\n\n1. Block reference\n\n2. Start index, inclusive\n\n3. End index, inclusive\n\n4. Format",
    handler: (
      text,
      start = "1",
      endArg = "0",
      format = "{text}",
      levelsIncluded = "0"
    ) => {
      const tree = getLevelsBelowParentUid(text, levelsIncluded);
      const end = Number(endArg) || 0;
      return tree
        .slice(Number(start) - 1, end <= 0 ? tree.length + end : end)
        .map((n) => formatTree(n, format));
    },
  },
  {
    text: "ALLUSERS",
    help: "Gets all users in the graph",
    handler: () => {
      const users = (
        window.roamAlphaAPI.data.fast.q(
          `[:find (pull ?p [:user/email]) (pull ?r [:node/title]) :where 
        [?p :user/display-page ?r]
     ]`
        ) as [PullBlock, PullBlock][]
      ).map(([p, r]) =>
        r[":node/title"]?.startsWith("Anonymous") && p
          ? // @ts-ignore it does exist
            (p[":user/email"] as string) || r[":node/title"]
          : r?.[":node/title"] || ""
      );
      return users;
    },
  },
  {
    text: "AUTHOR",
    help: "Returns the user who created the block or page \n\n1: Page name or UID.",
    handler: (titleOrUid = "") => {
      const uid = getUidFromText(titleOrUid);
      const user = window.roamAlphaAPI.pull("[:create/user]", [
        ":block/uid",
        uid,
      ])?.[":create/user"]?.[":db/id"];
      if (!user) return "";
      const displayPage = window.roamAlphaAPI.pull(
        "[:user/display-page]",
        user
      )?.[":user/display-page"]?.[":db/id"];
      if (!displayPage) return "";
      const username =
        window.roamAlphaAPI.pull("[:node/title :block/uid]", displayPage)?.[
          ":node/title"
        ] || "Anonymous";
      return username;
    },
  },
  {
    text: "DELETEBLOCK",
    help: "Deletes the block or page. \n\n1: Page name, UID, or variable.",
    handler: (uidOrVar = "") => {
      const uid = getUidFromText(uidOrVar);
      deleteBlock(uid);
      return "";
    },
  },
  {
    text: "SETPROPS",
    help: "Sets the current block's Roam props based on the tree of values referenced by the first argument\n\n1. Block reference",
    handler: async (uidOrVar = "") => {
      const blockUid = getUidFromText(uidOrVar);
      const [formConfig] = await processBlockUid(blockUid);
      if (!formConfig) return "";
      const toObject = (node: InputTextNode): Record<string, unknown> =>
        Object.fromEntries(
          (node.children || []).map((c) => [
            c.text,
            c.children?.length === 1 && c.children[0].children?.length === 0
              ? c.children[0].text
              : (c.children || []).every((cc) => !cc.children?.length)
              ? (c.children || []).map((cc) => cc.text)
              : toObject(c),
          ])
        );
      return [{ props: toObject(formConfig), text: "" }];
    },
  },
];
export const handlerByCommand = Object.fromEntries(
  COMMANDS.map(({ text, help, ...rest }) => [text, rest])
);

export const proccessBlockText = async (
  s: string
): Promise<InputTextNode[]> => {
  try {
    const nextBlocks: InputTextNode[] = [];
    const currentChildren: InputTextNode[] = [];
    const promises = processBlockTextToPromises(s);
    const props = await processPromisesToBlockProps(
      promises,
      nextBlocks,
      currentChildren
    );
    return [
      {
        ...props,
        children: currentChildren,
      },
      ...nextBlocks,
    ];
  } catch (e) {
    const error = e as Error;
    apiPost({
      domain: "https://api.samepage.network",
      path: "errors",
      data: {
        method: "extension-error",
        type: "Process Block Text Failed",
        data: {
          text: s,
        },
        message: error.message,
        stack: error.stack,
        version: process.env.VERSION,
      },
    }).catch(() => {});
    return [
      {
        children: [],
        text: `Block threw an error while running: ${s.substring(
          0,
          s.length > 50 ? 47 : 50
        )}${s.length > 50 ? "..." : ""}`,
      },
    ];
  }
};

const flattenText = (blocks: InputTextNode[]): string[] =>
  blocks.flatMap((block) => [block.text, ...flattenText(block.children || [])]);

const flattenUids = (blocks: RoamBasicNode[]): string[] =>
  blocks.flatMap((block) => [block.uid, ...flattenUids(block.children || [])]);

const processBlockTextToPromises = (s: string) => {
  const matches = XRegExp.matchRecursive(s, "<%", "%>", "g", {
    valueNames: ["text", null, "command", null],
    escapeChar: "\\",
    unbalanced: "skip",
  });
  return (
    matches.length
      ? matches
      : ([{ name: "text", value: s }] as XRegExp.MatchRecursiveValueNameMatch[])
  ).map((c) => () => {
    if (
      smartBlocksContext.exitBlock === "yes" ||
      smartBlocksContext.exitWorkflow
    ) {
      return Promise.resolve<InputTextNode[]>([{ text: "" }]);
    }
    if (c.name === "text") {
      return Promise.resolve<InputTextNode[]>([{ text: c.value }]);
    }
    const split = c.value.indexOf(":");
    const cmd = split < 0 ? c.value : c.value.substring(0, split);
    const afterColon = split < 0 ? "" : c.value.substring(split + 1);
    let commandStack = 0;
    const args = afterColon.split("").reduce((prev, cur, i, arr) => {
      if (cur === "," && !commandStack && arr[i - 1] !== "\\") {
        return [...prev, ""];
      } else if (cur === "\\" && arr[i + 1] === ",") {
        return prev;
      } else {
        if (cur === "%") {
          if (arr[i - 1] === "<") {
            commandStack++;
          } else if (arr[i + 1] === ">") {
            commandStack--;
          }
        }
        const current = prev.slice(-1)[0] || "";
        return [...prev.slice(0, -1), `${current}${cur}`];
      }
    }, [] as string[]);
    const { handler, delayArgs, illegal } = handlerByCommand[cmd] || {};
    if (illegal) smartBlocksContext.illegalCommands.add(cmd);
    return (
      delayArgs
        ? Promise.resolve({ args, nodeProps: {} })
        : args
            .map((s) => () => proccessBlockText(s))
            .reduce(
              (prev, cur) =>
                prev.then((p) =>
                  cur().then((c) => {
                    return [...p, c];
                  })
                ),
              Promise.resolve([] as InputTextNode[][])
            )
            .then((s) => {
              if (!s.length) return { args: [], nodeProps: {} };
              return {
                args: s.flatMap((c) => flattenText(c)),
                nodeProps: s.reduce((prev, cur) => {
                  const nodeProps = { ...cur[0] } || ({} as InputTextNode);
                  const { text, uid, children, ...rest } = nodeProps;
                  return { ...prev, ...rest };
                }, {}),
              };
            })
    )
      .then(({ args, nodeProps }) =>
        !!handler
          ? Promise.resolve(handler(...args)).then((output) => ({
              output,
              nodeProps,
            }))
          : {
              output: `<%${cmd}${args.length ? `:${args.join(",")}` : ""}%>`,
              nodeProps,
            }
      )
      .then(({ output, nodeProps }) =>
        typeof output === "string"
          ? [{ text: output, ...nodeProps }]
          : Array.isArray(output)
          ? output.map((o: string | InputTextNode) =>
              typeof o === "string" ? { text: o, ...nodeProps } : o
            )
          : Promise.reject(
              `Command handler output expected a string or array, but instead got ${typeof output}`
            )
      );
  });
};

const processPromisesToBlockProps = async (
  promises: (() => Promise<InputTextNode[]>)[],
  nextBlocks: InputTextNode[],
  currentChildren: InputTextNode[]
): Promise<Omit<InputTextNode, "uid" | "children">> => {
  const data = await processPromises(
    promises.map(
      (p) => (prev) =>
        p().then((c) => {
          prev.push(c);
        })
    )
  );

  return data.reduce(
    (prev, blocks) => {
      const { text = "", children = [], uid: _, ...rest } = blocks[0] || {};
      currentChildren.push(...children);
      nextBlocks.push(...blocks.slice(1));
      return { text: `${prev.text}${text}`, ...rest };
    },
    { text: "" }
  );
};

// ridiculous method names in this file are a tribute to the original author of SmartBlocks, RoamHacker 🙌
export const proccessBlockWithSmartness = async (
  n: InputTextNode
): Promise<InputTextNode[]> => {
  try {
    const nextBlocks: InputTextNode[] = [];
    const currentChildren: InputTextNode[] = [];
    const promises = processBlockTextToPromises(n.text).map(
      (p) => () =>
        p().then((t) => {
          smartBlocksContext.currentContent += t[0]?.text || "";
          return t;
        })
    );
    const props = await processPromisesToBlockProps(
      promises,
      nextBlocks,
      currentChildren
    );
    const oldExitBlock = smartBlocksContext.exitBlock;
    if (smartBlocksContext.exitBlock !== "no") {
      smartBlocksContext.exitBlock = "no";
      if (oldExitBlock === "yes" || oldExitBlock === "end" || !props.text) {
        return [];
      }
    }
    const processedChildren = await processChildren({
      nodes: n.children || [],
      nextBlocks,
    });
    const children = [...currentChildren, ...processedChildren];
    if (!children.length && oldExitBlock === "childless") {
      return [];
    }
    const { textAlign, viewType, heading, open } = n;
    return [
      {
        textAlign,
        viewType,
        heading,
        open,
        ...props,
        children,
      },
      ...nextBlocks,
    ];
  } catch (e) {
    const error = e as Error;
    apiPost({
      domain: "https://api.samepage.network",
      path: "errors",
      data: {
        method: "extension-error",
        type: "Process Block With Smartness Fail",
        data: {
          node: n,
        },
        message: error.message ? error.message : error.toString(),
        stack: error.stack,
        version: process.env.VERSION,
        notebookUuid: JSON.stringify({
          owner: "RoamJS",
          app: "smartblocks",
          workspace: window.roamAlphaAPI.graph.name,
        }),
      },
    }).catch(() => {});
    return [
      {
        children: [],
        text: `Block threw an error while running: ${n.text.substring(
          0,
          n.text.length > 50 ? 47 : 50
        )}${n.text.length > 50 ? "..." : ""}`,
      },
    ];
  }
};

export const processBlockUid = async (uid: string) =>
  proccessBlockWithSmartness({
    text: getTextByBlockUid(uid),
    uid,
    children: getBasicTreeByParentUid(uid),
  });

const processPromises = (
  nodes: ((prev: InputTextNode[][]) => Promise<void>)[] = []
) =>
  nodes.reduce(
    (prev, cur) => prev.then((r) => cur(r).then(() => r)),
    Promise.resolve([] as InputTextNode[][])
  );

const processChildren = ({
  nodes = [],
  introUid,
  introContent,
  nextBlocks,
}: {
  nodes: InputTextNode[];
  introUid?: string;
  introContent?: string;
  nextBlocks?: InputTextNode[];
}) =>
  processPromises(
    nodes.map((n, i) => (prev) => {
      if (smartBlocksContext.exitWorkflow) {
        return Promise.resolve();
      }
      const uid =
        (i === 0 && introUid) ||
        (prev.every((arr) => arr.length === 0) && introUid) ||
        window.roamAlphaAPI.util.generateUID();

      smartBlocksContext.refMapping[n.uid || ""] = uid;
      smartBlocksContext.currentUid = uid;
      smartBlocksContext.currentContent = introContent || "";
      return proccessBlockWithSmartness(n)
        .then((b) => {
          if (b.length) {
            b[0].uid = uid;
          }
          return b;
        })
        .then((c) => {
          const indent = smartBlocksContext.indent.has(uid);
          const unindent = smartBlocksContext.unindent.has(uid);
          if (unindent && !indent && nextBlocks) {
            nextBlocks.push(...c);
          } else if (!prev.length || !indent || unindent) {
            prev.push(c);
          } else if (indent) {
            (prev.slice(-1)[0].slice(-1)[0].children || []).push(...c);
          }
          smartBlocksContext.indent.delete(uid);
          smartBlocksContext.unindent.delete(uid);
        });
    })
  ).then((results) => results.flatMap((r) => r));

const resolveRefs = (nodes: InputTextNode[]): InputTextNode[] =>
  nodes.map((node) => ({
    ...node,
    text: node.text.replace(
      BLOCK_REF_REGEX,
      (_, ref) => `((${smartBlocksContext.refMapping[ref] || ref}))`
    ),
    children: resolveRefs(node.children || []),
  }));

const count = (t: InputTextNode[] = []): number =>
  t.map((c) => count(c.children) + 1).reduce((p, c) => p + c, 0);

export const sbBomb = async ({
  srcUid,
  target: { uid, start = 0, end = start, isParent = false, windowId },
  variables = {},
  mutableCursor,
  triggerUid = uid,
  fromDaily = false,
}: {
  srcUid: string;
  target: {
    uid: string;
    start?: number;
    end?: number;
    isParent?: boolean;
    windowId?: string;
  };
  variables?: Record<string, string>;
  mutableCursor?: boolean;
  triggerUid?: string;
  fromDaily?: boolean;
}): Promise<0 | string> => {
  const finish = renderLoading(uid);
  resetContext({ targetUid: uid, variables, triggerUid });
  const childNodes = PREDEFINED_REGEX.test(srcUid)
    ? predefinedChildrenByUid[srcUid] || []
    : getFullTreeByParentUid(srcUid).children;
  const props: { introUid?: string; introContent?: string; suffix?: string } =
    {};
  if (!isParent) {
    const originalText = getTextByBlockUid(uid);
    const prefix = originalText.substring(0, start);
    const suffix = originalText.substring(end);
    await updateBlock({
      uid,
      text: `${prefix}${suffix}`,
    });
    props.introUid = uid;
    props.introContent = prefix;
    props.suffix = suffix;
  }
  return processChildren({
    nodes: childNodes,
    ...props,
  })
    .then(resolveRefs)
    .then(async (tree) => {
      const [firstChild, ...next] = tree;
      if (firstChild) {
        const startingOrder = isParent
          ? getChildrenLengthByPageUid(uid)
          : getOrderByBlockUid(uid);
        const parentUid = isParent ? uid : getParentUidByBlockUid(uid);
        const outputUid = await (isParent
          ? createBlock({
              node: firstChild,
              parentUid,
              order: startingOrder,
            })
          : Promise.resolve(getTextByBlockUid(uid))
              .then((textPostProcess) => {
                const indexDiffered = textPostProcess
                  .split("")
                  .findIndex(
                    (c, i) => c !== (props.introContent || "").charAt(i)
                  );
                return updateBlock({
                  ...firstChild,
                  uid,
                  text: `${
                    indexDiffered < 0
                      ? textPostProcess
                      : textPostProcess.slice(0, indexDiffered)
                  }${firstChild.text || ""}${
                    indexDiffered < 0
                      ? ""
                      : textPostProcess.substring(indexDiffered)
                  }`,
                });
              })
              .then(() =>
                Promise.all(
                  (firstChild.children || []).map((node, order) =>
                    createBlock({ order, parentUid: uid, node })
                  )
                )
              )
              .then(() => uid));
        await Promise.all(
          next.map((node, i) =>
            createBlock({
              parentUid,
              order: startingOrder + 1 + i,
              node,
            })
          )
        );
        return outputUid;
      }
      return 0;
    })
    .then(async (output) => {
      if (smartBlocksContext.focusOnBlock) {
        await window.roamAlphaAPI.ui.mainWindow.openBlock({
          block: { uid: smartBlocksContext.focusOnBlock },
        });
      } else if (typeof mutableCursor === "boolean") {
        if (mutableCursor) {
          if (smartBlocksContext.cursorPosition) {
            const { uid: blockUid, selection } =
              smartBlocksContext.cursorPosition;
            // There's a bug with this setter below where the promise doesn't resolve
            window.roamAlphaAPI.ui.setBlockFocusAndSelection({
              location: {
                "block-uid": blockUid,
                "window-id":
                  windowId ||
                  `${getCurrentUserUid()}-body-outline-${getPageUidByBlockUid(
                    blockUid
                  )}`,
              },
              selection: { start: selection },
            });
          }
        } else if (document.activeElement?.tagName === "TEXTAREA") {
          (document.activeElement as HTMLTextAreaElement).blur();
        }
      }
      return output;
    })
    .then((c) =>
      Promise.all(smartBlocksContext.afterWorkflowMethods.map((w) => w()))
        .catch((e) => console.error(e))
        .then(() => c)
    )
    .finally(() => {
      finish();
      if (
        smartBlocksContext.illegalCommands.size &&
        process.env.ROAM_MARKETPLACE !== "true"
      ) {
        renderSimpleAlert({
          content: `WARNING: The SmartBlocks workflow you just ran uses the following commands:

${Array.from(smartBlocksContext.illegalCommands)
  .sort()
  .map((c) => `- \`${c}\``)
  .join("\n")}

These commands are removed in the RoamDepot version of SmartBlocks, which will be the primary version maintained going forward. Please visit our [migration guide](https://roamjs.com/extensions/smartblocks/migration_guide) on how to migrate away from these commands, or contact the original author of the SmartBlock workflow for an update.
`,
          externalLink: true,
        });
      }

      if (!fromDaily) {
        const dailyWorkflowName = getDailyConfig()["workflow name"];
        const srcName = getTextByBlockUid(srcUid)
          .replace(createTagRegex("SmartBlock"), "")
          .replace(createTagRegex("42SmartBlock"), "")
          .replace(/<%[A-Z]+%>/, "")
          .trim();
        if (dailyWorkflowName === srcName) {
          // TODO - solve circular dependency
          scheduleNextDailyRun({ tomorrow: true, saveLastRun: true });
        }
      }
    });
};
