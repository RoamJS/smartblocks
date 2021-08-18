import {
  DAILY_NOTE_PAGE_REGEX,
  getTreeByBlockUid,
  getOrderByBlockUid,
  getParentUidByBlockUid,
  updateBlock,
  createBlock,
  getTextByBlockUid,
  InputTextNode,
  toRoamDate,
  getBlockUidsAndTextsReferencingPage,
  getBlockUidsWithParentUid,
  createTagRegex,
  getAllBlockUids,
  getAllPageNames,
  extractTag,
  getPageUidByPageTitle,
  getPageTitleByBlockUid,
  parseRoamDate,
  getParentUidsOfBlockUid,
  BLOCK_REF_REGEX,
  getCurrentUserDisplayName,
  openBlock,
  getRoamUrl,
  getBlockUidAndTextIncludingText,
} from "roam-client";
import * as chrono from "chrono-node";
import datefnsFormat from "date-fns/format";
import addDays from "date-fns/addDays";
import addWeeks from "date-fns/addWeeks";
import subDays from "date-fns/subDays";
import isBefore from "date-fns/isBefore";
import isAfter from "date-fns/isAfter";
import startOfWeek from "date-fns/startOfWeek";
import startOfMonth from "date-fns/startOfMonth";
import startOfYear from "date-fns/startOfYear";
import endOfWeek from "date-fns/endOfWeek";
import endOfMonth from "date-fns/endOfMonth";
import endOfYear from "date-fns/endOfYear";
import differenceInDays from "date-fns/differenceInDays";
import XRegExp from "xregexp";
import { renderPrompt } from "./Prompt";
import { renderToast } from "roamjs-components";
import { ParsingComponents } from "chrono-node/dist/results";
import { ORDINAL_WORD_DICTIONARY } from "./dom";

export const PREDEFINED_REGEX = /#\d*-predefined/;
const PAGE_TITLE_REGEX = /^(?:#?\[\[(.*)\]\]|#([^\s]*))$/;
const DAILY_REF_REGEX = new RegExp(
  `#?\\[\\[(${DAILY_NOTE_PAGE_REGEX.source})\\]\\]`
);
const getDateFromText = (s: string) =>
  parseRoamDate(DAILY_REF_REGEX.exec(s)?.[1]);

const ORDINAL_REGEX = new RegExp(
  `\\b(?:${Object.keys(ORDINAL_WORD_DICTIONARY)
    .sort((a, b) => b.length - a.length)
    .join("|")}|(?:[1-9])?[0-9](?:st|nd|rd|th)?)\\b`,
  "i"
);
const customDateNlp = chrono.casual.clone();
customDateNlp.parsers.push(
  {
    pattern: () => /\b((start|end) )?of\b/i,
    extract: () => ({}),
  },
  {
    pattern: () => ORDINAL_REGEX,
    extract: () => ({}),
  }
);
const assignDay = (p: ParsingComponents, d: Date) => {
  p.assign("year", d.getFullYear());
  p.assign("month", d.getMonth() + 1);
  p.assign("day", d.getDate());
};
customDateNlp.refiners.unshift({
  refine: (_, results) => {
    if (results.length >= 2) {
      const [modifier, date, ...rest] = results;
      if (/start of/i.test(modifier.text)) {
        const dateObj = date.date();
        if (/week/i.test(date.text)) {
          const newDateObj = startOfWeek(dateObj);
          assignDay(date.start, newDateObj);
        }
        if (/month/i.test(date.text)) {
          const newDateObj = startOfMonth(dateObj);
          assignDay(date.start, newDateObj);
        }
        if (/year/i.test(date.text)) {
          const newDateObj = startOfYear(dateObj);
          assignDay(date.start, newDateObj);
        }
      } else if (/end of/i.test(modifier.text)) {
        const dateObj = date.date();
        if (/week/i.test(date.text)) {
          const newDateObj = endOfWeek(dateObj);
          assignDay(date.start, newDateObj);
        }
        if (/month/i.test(date.text)) {
          const newDateObj = endOfMonth(dateObj);
          assignDay(date.start, newDateObj);
        }
        if (/year/i.test(date.text)) {
          const newDateObj = endOfYear(dateObj);
          assignDay(date.start, newDateObj);
        }
      } else if (rest.length >= 2) {
        const [of, d, ...moreRest] = rest;
        if (
          ORDINAL_REGEX.test(modifier.text) &&
          date.start.isOnlyWeekdayComponent() &&
          /of/i.test(of.text)
        ) {
          const match = ORDINAL_REGEX.exec(modifier.text)[0].toLowerCase();
          const num =
            ORDINAL_WORD_DICTIONARY[match] ||
            Number(match.replace(/(?:st|nd|rd|th)$/i, ""));
          const dateObj = d.date();
          if (/month/i.test(d.text)) {
            const startOfMonthDate = startOfMonth(dateObj);
            const originalMonth = startOfMonthDate.getMonth();
            const startOfWeekDate = startOfWeek(startOfMonthDate);
            const dayOfWeekDate = addDays(
              startOfWeekDate,
              date.start.get("weekday")
            );
            const newDateObj = addWeeks(
              dayOfWeekDate,
              num - (originalMonth === dayOfWeekDate.getMonth() ? 1 : 0)
            );
            assignDay(d.start, newDateObj);
          } else if (/year/i.test(d.text)) {
            const startOfYearDate = startOfYear(dateObj);
            const originalYear = startOfYearDate.getFullYear();
            const startOfWeekDate = startOfWeek(startOfYearDate);
            const dayOfWeekDate = addDays(
              startOfWeekDate,
              date.start.get("weekday")
            );
            const newDateObj = addWeeks(
              dayOfWeekDate,
              num - (originalYear === dayOfWeekDate.getFullYear() ? 1 : 0)
            );
            assignDay(d.start, newDateObj);
          } else {
            return results;
          }
          return [d, ...moreRest];
        }
      } else {
        return results;
      }
      return [date, ...rest];
    }
    return results;
  },
});

const AsyncFunction: FunctionConstructor = new Function(
  `return Object.getPrototypeOf(async function(){}).constructor`
)();

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
    { text: "Time 24", children: [{ text: "<%TIME%>" }] },
    { text: "Time AM/PM", children: [{ text: "<%TIMEAMPM%>" }] },
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

export const HIDE_REGEX = /<%HIDE%>/;
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

const getFormatter =
  (format: string) =>
  ({ uid }: { uid: string }) => ({
    text: format
      .replace("{uid}", uid)
      .replace("{page}", getPageTitleByBlockUid(uid))
      .replace(
        "{path}",
        getParentUidsOfBlockUid(uid)
          .map((t) => `((${t[0]}))`)
          .reverse()
          .join(" > ")
      ),
  });

const outputTodoBlocks = (
  blocks: { text: string; uid: string }[],
  limit = "20",
  format = "(({uid}))",
  ...search: string[]
) =>
  blocks
    .filter(({ text }) => !/{{(\[\[)?query(\]\])?/.test(text))
    .filter(({ text }) =>
      search.every((s) =>
        /^-/.test(s) ? !text.includes(s.substring(1)) : text.includes(s)
      )
    )
    .slice(0, Number(limit))
    .map(getFormatter(format));

type CommandOutput = string | string[] | InputTextNode[];
export type CommandHandler = (
  ...args: string[]
) => CommandOutput | Promise<CommandOutput>;

export type SmartBlocksContext = {
  onBlockExit: CommandHandler;
  targetUid: string;
  ifCommand?: boolean;
  exitBlock: boolean;
  exitWorkflow: boolean;
  variables: Record<string, string>;
  cursorPosition?: { uid: string; selection: number };
  currentUid?: string;
  currentLength: number;
  indent: Set<string>;
  unindent: Set<string>;
  focusOnBlock?: string;
};

export const smartBlocksContext: SmartBlocksContext = {
  onBlockExit: () => "",
  targetUid: "",
  exitBlock: false,
  exitWorkflow: false,
  variables: {},
  currentLength: 0,
  indent: new Set(),
  unindent: new Set(),
};
const resetContext = (targetUid: string, variables: Record<string, string>) => {
  smartBlocksContext.onBlockExit = () => "";
  smartBlocksContext.targetUid = targetUid;
  smartBlocksContext.ifCommand = undefined;
  smartBlocksContext.exitBlock = false;
  smartBlocksContext.exitWorkflow = false;
  smartBlocksContext.variables = variables;
  smartBlocksContext.cursorPosition = undefined;
  smartBlocksContext.currentUid = undefined;
  smartBlocksContext.focusOnBlock = undefined;
  smartBlocksContext.currentLength = 0;
  smartBlocksContext.indent = new Set();
  smartBlocksContext.unindent = new Set();
};

const javascriptHandler =
  (fcn: FunctionConstructor): CommandHandler =>
  (...args) => {
    const content = args.join(",");
    const code = content
      .replace(/^\s*```javascript(\n)?/, "")
      .replace(/(\n)?```\s*$/, "")
      .replace(/^\s*`/, "")
      .replace(/`\s*$/, "");
    const variables = Object.keys(smartBlocksContext.variables).filter(
      (s) => !!s
    );
    return Promise.resolve(
      new fcn(...variables, code)(
        ...variables.map((v) => smartBlocksContext.variables[v])
      )
    ).then((result) => {
      if (typeof result === "undefined" || result === null) {
        return "";
      } else if (Array.isArray(result)) {
        return result.map((r) => {
          if (typeof r === "undefined" || r === null) {
            return "";
          } else if (typeof r === "object") {
            return {
              text: (r.text || "").toString(),
              children: [...r.children],
            };
          } else {
            return r.toString();
          }
        });
      } else {
        return result.toString();
      }
    });
  };

const COMMANDS: {
  text: string;
  help: string;
  args?: true;
  handler: CommandHandler;
}[] = [
  {
    text: "DATE",
    help: "Returns a Roam formatted dated page reference.\n\n1: NLP expression\n2: optional: format for returned date, example: YYYY-MM-DD",
    args: true,
    handler: (nlp, format) => {
      if (!nlp) {
        return `[[${toRoamDate(new Date())}]]`;
      }
      const date = customDateNlp.parseDate(nlp);
      if (format) {
        return datefnsFormat(date, format, {
          useAdditionalDayOfYearTokens: true,
          useAdditionalWeekYearTokens: true,
        });
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
    help: "Returns a random child block from a page or block ref\n\n1: Page name or UID.",
    handler: (titleOrUid = "") => {
      const possibleTitle = extractTag(titleOrUid);
      const parentUid = getPageUidByPageTitle(possibleTitle) || titleOrUid;
      const uids = getBlockUidsWithParentUid(parentUid);
      const uid = uids[Math.floor(Math.random() * uids.length)];
      return uids.length ? `((${uid}))` : "No blocks on page!";
    },
  },
  {
    text: "RANDOMBLOCKMENTION",
    help: "Returns random block where page ref mentioned\n\n1: Page name or UID",
    handler: (...args) => {
      const refUids = args.map((titleOrUid) => {
        const possibleTitle = extractTag(titleOrUid);
        return getPageUidByPageTitle(possibleTitle) || titleOrUid;
      });
      if (!refUids.length) {
        return "Please include at least one page name or UID.";
      }
      const uids = window.roamAlphaAPI
        .q(
          `[:find ?u :where [?r :block/uid ?u] ${refUids
            .map(
              (uid, i) => `[?r :block/refs ?b${i}] [?b${i} :block/uid "${uid}"]`
            )
            .join(" ")}]`
        )
        .map((s) => s[0]);
      const uid = uids[Math.floor(Math.random() * uids.length)];
      return uids.length ? `((${uid}))` : "No uids found with these tags";
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
    text: "TODOTODAY",
    help: "Returns a list of block refs of TODOs for today\n\n1. Max # blocks\n2. Format of output.\n3. optional filter values",
    handler: (...args) => {
      const today = toRoamDate(new Date());
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
        ]`)
        .map(([uid, text]) => ({ uid, text }));
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOOVERDUE",
    help: "Returns a list of block refs of TODOs that are Overdue\n\n1. Max # blocks\n2. Format of output.\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const yesterday = subDays(new Date(), 1);
      const todos = blocks
        .filter(({ text }) => DAILY_REF_REGEX.test(text))
        .map(({ text, uid }) => ({
          text,
          uid,
          date: parseRoamDate(DAILY_REF_REGEX.exec(text)[1]),
        }))
        .filter(({ date }) => isBefore(date, yesterday))
        .sort(({ date: a }, { date: b }) => a.valueOf() - b.valueOf());
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOOVERDUEDNP",
    help: "Returns a list of block refs of TODOs that are Overdue including DNP TODOs\n\n1. Max # blocks\n2. Format of output.\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const yesterday = subDays(new Date(), 1);
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
          date: parseRoamDate(date),
        }))
        .filter(({ date }) => isBefore(date, yesterday))
        .sort(({ date: a }, { date: b }) => a.valueOf() - b.valueOf());
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOFUTURE",
    help: "Returns a list of block refs of TODOs that are due in the future\n\n1. Max # blocks\n2. Format of output.\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = new Date();
      const todos = blocks
        .filter(({ text }) => DAILY_REF_REGEX.test(text))
        .map(({ text, uid }) => ({
          text,
          uid,
          date: parseRoamDate(DAILY_REF_REGEX.exec(text)[1]),
        }))
        .filter(({ date }) => isAfter(date, today))
        .sort(({ date: a }, { date: b }) => a.valueOf() - b.valueOf());
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOFUTUREDNP",
    help: "Returns a list of block refs of TODOs that are due in the future including DNP TODOs\n\n1. Max # blocks\n2. Format of output.\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = new Date();
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
          date: parseRoamDate(date),
        }))
        .filter(({ date }) => isAfter(date, today))
        .sort(({ date: a }, { date: b }) => a.valueOf() - b.valueOf());
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOUNDATED",
    help: "Returns a list of block refs of TODOs with no date\n\n1. Max # blocks\n2. Format of output.\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const todos = blocks
        .filter(({ text }) => !DAILY_REF_REGEX.test(text))
        .sort(({ text: a }, { text: b }) => a.localeCompare(b));
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "INPUT",
    help: "Prompts user for input which will then be inserted into block\n\n1: text to display in prompt. Add a @@ followed by text for a default value",
    handler: async (...args) => {
      const [display, initialValue, ...options] = args.join(",").split("%%");
      return await renderPrompt({ display, initialValue, options });
    },
  },
  {
    text: "JAVASCRIPT",
    help: "Custom JavaScript code to run\n\n1. JavaScript code",
    handler: javascriptHandler(Function),
  },
  {
    text: "J",
    help: "Shortcut for Custom JavaScript code to run\n\n1. JavaScript code",
    handler: javascriptHandler(Function),
  },
  {
    text: "JAVASCRIPTASYNC",
    help: "Custom asynchronous JavaScript code to run\n\n1. JavaScipt code",
    handler: javascriptHandler(AsyncFunction),
  },
  {
    text: "JA",
    help: "Shortcut for custom asynchronous JavaScript code to run\n\n1. JavaScipt code",
    handler: javascriptHandler(AsyncFunction),
  },
  {
    text: "ONBLOCKEXIT",
    help: "Asynchronous JavaScript code to \nrun after a block has been\nprocessed by Roam42\n1. JavaScipt code\nReturn value not processed",
    handler: (...args) => {
      smartBlocksContext.onBlockExit = () =>
        javascriptHandler(AsyncFunction)(...args);
      return "";
    },
  },
  {
    text: "BREADCRUMBS",
    help: "Returns a list of parent block refs to a given block ref\n\n1: Block reference\n2: Separator used between block references",
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
    text: "CURRENTBLOCKREF",
    help: "Sets a variable to the block UID for the current block\n\n1. Variable name",
    handler: (name = "") => {
      if (name) {
        smartBlocksContext.variables[name] = smartBlocksContext.currentUid;
      }
      return smartBlocksContext.currentUid;
    },
  },
  {
    text: "CONCAT",
    help: "Combines a comma separated list of strings into one string\n\n1: comma separated list",
    handler: (...args) => {
      return args.join("");
    },
  },
  {
    text: "CURRENTPAGENAME",
    help: "Returns the current page name the smart block is running in.",
    handler: (mode) => {
      const title = getPageTitleByBlockUid(smartBlocksContext.targetUid);
      return mode === "base" ? title.split("/").slice(-1)[0] : title;
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
      getCurrentUserDisplayName() || "No Diplay Name for Current User",
  },
  {
    text: "BLOCKMENTIONS",
    help: "Returns list of blocks mentioned\n\n1: Max blocks to return\n2: Page or Tag Name\n3:Format of output.\n4: (opt) filtering",
    handler: (
      limitArg = "20",
      titleArg = "",
      format = "(({uid}))",
      ...search: string[]
    ) => {
      const limit = Number(limitArg);
      const title = extractTag(titleArg);
      const results = getBlockUidsAndTextsReferencingPage(title).filter(
        ({ text }) =>
          search.every((s) =>
            s.startsWith("-")
              ? !text.includes(s.substring(1))
              : text.includes(s)
          )
      );
      if (limit === -1) return `${results.length}`;
      return results
        .sort((a, b) => a.text.localeCompare(b.text))
        .slice(0, limit)
        .map(getFormatter(format));
    },
  },
  {
    text: "BLOCKMENTIONSDATED",
    help: "Returns list of blocks mentioned based on date range\n1: Max blocks to return\n2: Page or Tag Name\n3: Start Date\n4. End Date\n5: Sort (ASC,DESC,NONE)\n6:Format of Output\n7: (opt) filtering ",
    handler: (
      limitArg = "20",
      titleArg = "",
      startArg = "",
      endArg = "",
      sort = "ASC",
      format = "(({uid}))",
      ...search: string[]
    ) => {
      const undated = startArg === "-1" && endArg === "-1";
      const start =
        !undated && startArg ? customDateNlp.parseDate(startArg) : new Date(0);
      const end =
        !undated && endArg
          ? customDateNlp.parseDate(endArg)
          : new Date(9999, 11, 31);
      const limit = Number(limitArg);
      const title = extractTag(titleArg);
      const results = getBlockUidsAndTextsReferencingPage(title)
        .filter(({ text }) => {
          const ref = DAILY_REF_REGEX.exec(text)?.[1];
          if (ref) {
            const d = parseRoamDate(ref);
            return undated! && !isBefore(d, start) && !isAfter(d, end);
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
                getDateFromText(b.text).valueOf() -
                getDateFromText(a.text).valueOf()
            : (a, b) =>
                getDateFromText(a.text).valueOf() -
                getDateFromText(b.text).valueOf()
        )
        .slice(0, limit)
        .map(getFormatter(format));
    },
  },
  {
    text: "IF",
    help: "Evaluates a condition for true. Use with THEN & ELSE.\n\n1: Logic to be evaluated\n2: (Optional) Value if true\n3: (Optional) Value if false",
    handler: (condition = "false", then, els) => {
      try {
        const evaluated = eval(condition);
        if (evaluated) {
          if (then) {
            return then;
          } else {
            smartBlocksContext.ifCommand = true;
            return "";
          }
        } else {
          if (els) {
            return els;
          } else {
            smartBlocksContext.ifCommand = false;
            return "";
          }
        }
      } catch (e) {
        return `Failed to evaluate IF condition: ${e.message}`;
      }
    },
  },
  {
    text: "THEN",
    help: "Used with IF when IF is true\n\n1: Text to be inserted",
    handler: (value) => {
      if (smartBlocksContext.ifCommand) {
        smartBlocksContext.ifCommand = undefined;
        return value;
      }
      return "";
    },
  },
  {
    text: "ELSE",
    help: "Used with IF when IF is false\n\n1: Text to be inserted",
    handler: (value) => {
      if (smartBlocksContext.ifCommand === false) {
        smartBlocksContext.ifCommand = undefined;
        return value;
      }
      return "";
    },
  },
  {
    text: "IFTRUE",
    help: "Test if parameter is true. If true, the block is output.\n\n1: Logic to be evaluated",
    handler: (condition) => {
      try {
        if (!eval(condition)) {
          smartBlocksContext.exitBlock = true;
        }
        return "";
      } catch (e) {
        return `Failed to evaluate IFTRUE condition: ${e.message}`;
      }
    },
  },
  {
    text: "IFDATEOFYEAR",
    help: "Compares today's date\n\n1: Comma separated list of dates (mm/dd)\nExample: 01/01,04/01,09/01",
    handler: (...dates) => {
      const today = new Date();
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
        smartBlocksContext.exitBlock = true;
      }
      return "";
    },
  },
  {
    text: "IFDAYOFMONTH",
    help: "Compares today's date\n\n1: Comma separated list of days\n Example: 5,10,15",
    handler: (...dates) => {
      const today = new Date();
      const match = dates
        .map((s) => s.trim())
        .map((s) => Number(s))
        .includes(today.getDate());
      if (!match) {
        smartBlocksContext.exitBlock = true;
      }
      return "";
    },
  },
  {
    text: "IFDAYOFWEEK",
    help: "Compares today's date\n\n1: Comma separated list of days of week. 1 is Monday, 7 is Sunday\nExample: 1,3",
    handler: (...dates) => {
      const today = new Date();
      const match = dates
        .map((s) => s.trim())
        .map((s) => (s === "7" ? 0 : Number(s)))
        .includes(today.getDay());
      if (!match) {
        smartBlocksContext.exitBlock = true;
      }
      return "";
    },
  },
  {
    text: "GET",
    help: "Returns a variable\n\n1. Variable name",
    handler: (name = "") => {
      return (
        smartBlocksContext.variables[name] || `--> Variable ${name} not SET <--`
      );
    },
  },
  {
    text: "SET",
    help: "Create a variable in memory\n\n1. Variable name\n2: Value of variable",
    handler: (name = "", value = "") => {
      smartBlocksContext.variables[name] = value;
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
        uid: smartBlocksContext.currentUid,
        selection: smartBlocksContext.currentLength,
      };
      return "";
    },
  },
  {
    text: "CURRENTBLOCKREF",
    help: "Sets a variable to the block UID for the current block\n\n1. Variable name",
    handler: (name = "") => {
      smartBlocksContext.variables[
        name
      ] = `((${smartBlocksContext.currentUid}))`;
      return "";
    },
  },
  {
    text: "INDENT",
    help: "Indents the current block if indentation can be done at current block. ",
    handler: () => {
      smartBlocksContext.indent.add(smartBlocksContext.currentUid);
      return "";
    },
  },
  {
    text: "UNINDENT",
    help: "Unidents at the current block if it can be done at current block. ",
    handler: () => {
      smartBlocksContext.unindent.add(smartBlocksContext.currentUid);
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
    help: "Displays notification window\n\n1: Seconds\n2: Message",
    handler: (timeoutArg, content) => {
      const timeout = (Math.max(Number(timeoutArg), 0) || 1) * 1000;
      renderToast({ id: "smartblocks-notification", timeout, content });
      return "";
    },
  },
  {
    text: "NOBLOCKOUTPUT",
    help: "No content output from a block",
    handler: () => {
      smartBlocksContext.exitBlock = true;
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
        .map(getFormatter(format));
    },
  },
  {
    text: "SUM",
    help: "Add all of the parameters together\n1: An addend to sum.",
    handler: (...args) =>
      args.reduce((a, b) => a + (Number(b) || 0), 0).toString(),
  },
  {
    text: "DIFFERENCE",
    help: "Find the difference between two parameters\n1: The minuend. 2: The subtrahend.",
    handler: (minuend = "0", subtrahend = "0") =>
      DAILY_NOTE_PAGE_REGEX.test(extractTag(minuend)) &&
      DAILY_NOTE_PAGE_REGEX.test(extractTag(subtrahend))
        ? differenceInDays(
            parseRoamDate(extractTag(minuend)),
            parseRoamDate(extractTag(subtrahend))
          ).toString()
        : ((Number(minuend) || 0) - (Number(subtrahend) || 0)).toString(),
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
    handler: () => {
      return navigator.clipboard.readText();
    },
  },
];
export const handlerByCommand = Object.fromEntries(
  COMMANDS.map((c) => [c.text, c.handler])
);

const proccessBlockText = async (s: string): Promise<InputTextNode[]> => {
  try {
    const nextBlocks: InputTextNode[] = [];
    const currentChildren: InputTextNode[] = [];
    const promises = processBlockTextToPromises(s, nextBlocks, currentChildren);
    const text = await processPromisesToBlockText(
      promises,
      nextBlocks,
      currentChildren
    );
    return [
      {
        text,
        children: currentChildren,
      },
      ...nextBlocks,
    ];
  } catch (e) {
    console.error(e);
    return [
      {
        children: [],
        text: `Block threw an error while running: ${s}`,
      },
    ];
  }
};

const processBlockTextToPromises = (
  s: string,
  nextBlocks: InputTextNode[],
  currentChildren: InputTextNode[]
) => {
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
    if (smartBlocksContext.exitBlock || smartBlocksContext.exitWorkflow) {
      return Promise.resolve<InputTextNode[]>([{ text: "" }]);
    }
    if (c.name === "text") {
      return Promise.resolve<InputTextNode[]>([{ text: c.value }]);
    }
    const split = c.value.indexOf(":");
    const cmd = split < 0 ? c.value : c.value.substring(0, split);
    const promiseArgs =
      split < 0
        ? Promise.resolve([])
        : proccessBlockText(c.value.substring(split + 1)).then((s) => {
            const [{ text, children }, ...rest] = s;
            nextBlocks.push(...rest);
            currentChildren.push(...(children || []));
            return text.split(/(?<!\\),/).map((s) => s.replace(/\\,/g, ","));
          });
    return promiseArgs
      .then((resolvedArgs) =>
        !!handlerByCommand[cmd]
          ? handlerByCommand[cmd](...resolvedArgs)
          : `<%${cmd}${
              resolvedArgs.length ? `:${resolvedArgs.join(",")}` : ""
            }%>`
      )
      .then((output) =>
        typeof output === "string"
          ? [{ text: output }]
          : output.map((o: string | InputTextNode) =>
              typeof o === "string" ? { text: o } : o
            )
      );
  });
};

const processPromisesToBlockText = async (
  promises: (() => Promise<InputTextNode[]>)[],
  nextBlocks: InputTextNode[],
  currentChildren: InputTextNode[]
) => {
  const data = await processPromises(
    promises.map(
      (p) => (prev) =>
        p().then((c) => {
          prev.push(c);
        })
    )
  );

  return data
    .map((blocks) => {
      currentChildren.push(...(blocks[0]?.children || []));
      nextBlocks.push(...blocks.slice(1));
      return blocks[0]?.text || "";
    })
    .join("");
};

// ridiculous method names in this file are a tribute to the original author of SmartBlocks, RoamHacker 🙌
const proccessBlockWithSmartness = async (
  n: InputTextNode
): Promise<InputTextNode[]> => {
  try {
    const nextBlocks: InputTextNode[] = [];
    const currentChildren: InputTextNode[] = [];
    const promises = processBlockTextToPromises(
      n.text,
      nextBlocks,
      currentChildren
    ).map(
      (p) => () =>
        p().then((t) => {
          smartBlocksContext.currentLength += t[0]?.text?.length || 0;
          return t;
        })
    );
    const text = await processPromisesToBlockText(
      promises,
      nextBlocks,
      currentChildren
    );
    if (smartBlocksContext.exitBlock) {
      smartBlocksContext.exitBlock = false;
      return [];
    }
    await smartBlocksContext.onBlockExit();
    const processedChildren = await processChildren({
      nodes: n.children,
      nextBlocks,
    });
    const { textAlign, viewType, heading } = n;
    return [
      {
        textAlign,
        viewType,
        heading,
        text,
        children: [...currentChildren, ...processedChildren],
      },
      ...nextBlocks,
    ];
  } catch (e) {
    console.error(e);
    return [
      {
        children: [],
        text: `Block threw an error while running: ${n.text}`,
      },
    ];
  }
};

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
  introLength,
  nextBlocks,
}: {
  nodes: InputTextNode[];
  introUid?: string;
  introLength?: number;
  nextBlocks?: InputTextNode[];
}) =>
  processPromises(
    nodes.map((n, i) => (prev) => {
      if (smartBlocksContext.exitWorkflow) {
        return Promise.resolve();
      }
      const uid =
        (i === 0 && introUid) || window.roamAlphaAPI.util.generateUID();
      smartBlocksContext.currentUid = uid;
      smartBlocksContext.currentLength = introLength || 0;
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
            prev
              .slice(-1)[0]
              .slice(-1)[0]
              .children.push(...c);
          }
          smartBlocksContext.indent.delete(uid);
          smartBlocksContext.unindent.delete(uid);
        });
    })
  ).then((results) => results.flatMap((r) => r));

export const sbBomb = ({
  srcUid,
  target: { uid, start, end },
  variables = {},
  mutableCursor,
}: {
  srcUid: string;
  target: { uid: string; start: number; end: number };
  variables?: Record<string, string>;
  mutableCursor?: boolean;
}): Promise<void> => {
  resetContext(uid, variables);
  const childNodes = PREDEFINED_REGEX.test(srcUid)
    ? predefinedChildrenByUid[srcUid]
    : getTreeByBlockUid(srcUid).children;
  const originalText = getTextByBlockUid(uid);
  updateBlock({
    uid,
    text: `${originalText.substring(0, start)}${originalText.substring(end)}`,
  });
  return new Promise((resolve) =>
    setTimeout(
      () =>
        processChildren({
          nodes: childNodes,
          introUid: uid,
          introLength: start,
        })
          .then(([firstChild, ...tree]) => {
            if (firstChild) {
              const startingOrder = getOrderByBlockUid(uid);
              const parentUid = getParentUidByBlockUid(uid);
              updateBlock({
                ...firstChild,
                uid,
                text: `${originalText.substring(0, start)}${
                  firstChild.text || ""
                }${originalText.substring(end)}`,
              });
              firstChild.children.forEach((node, order) =>
                createBlock({ order, parentUid: uid, node })
              );
              tree.forEach((node, i) =>
                createBlock({ parentUid, order: startingOrder + 1 + i, node })
              );
            }
            if (smartBlocksContext.focusOnBlock) {
              setTimeout(() => {
                window.location.assign(
                  getRoamUrl(smartBlocksContext.focusOnBlock)
                );
              }, 1000);
            } else if (typeof mutableCursor === "boolean") {
              if (mutableCursor) {
                if (smartBlocksContext.cursorPosition) {
                  if (
                    smartBlocksContext.cursorPosition.uid === uid &&
                    document.activeElement.tagName === "TEXTAREA" &&
                    document.activeElement.id.endsWith(uid)
                  ) {
                    const { selection } = smartBlocksContext.cursorPosition;
                    setTimeout(
                      () =>
                        (
                          document.activeElement as HTMLTextAreaElement
                        ).setSelectionRange(selection, selection),
                      1
                    );
                  } else {
                    const observer = new MutationObserver((mrs, obs) => {
                      const el = mrs
                        .flatMap((m) => Array.from(m.addedNodes))
                        .filter((d) => d.nodeName === "DIV")
                        .flatMap((m: HTMLDivElement) =>
                          Array.from(
                            m.querySelectorAll<HTMLDivElement>("div.roam-block")
                          )
                        )
                        .find((d) =>
                          d.id.endsWith(smartBlocksContext.cursorPosition.uid)
                        );
                      if (el) {
                        setTimeout(
                          () =>
                            openBlock(
                              el.id,
                              smartBlocksContext.cursorPosition.selection
                            ),
                          1
                        );
                        obs.disconnect();
                      }
                      // weird edge case with input and cursor as first block
                      const activeEl = mrs
                        .flatMap((m) => Array.from(m.addedNodes))
                        .find(
                          (d) =>
                            d === document.activeElement &&
                            d.nodeName === "TEXTAREA"
                        ) as HTMLTextAreaElement;
                      if (activeEl) {
                        setTimeout(
                          () =>
                            activeEl.setSelectionRange(
                              smartBlocksContext.cursorPosition.selection,
                              smartBlocksContext.cursorPosition.selection
                            ),
                          1
                        );
                        obs.disconnect();
                      }
                    });
                    observer.observe(document.body, {
                      childList: true,
                      subtree: true,
                    });
                    setTimeout(() => observer.disconnect(), 60000);
                  }
                }
              } else {
                setTimeout(
                  () =>
                    document.activeElement.tagName === "TEXTAREA" &&
                    (document.activeElement as HTMLTextAreaElement).blur(),
                  1
                );
              }
            }
          })
          .finally(resolve),
      1
    )
  );
};
