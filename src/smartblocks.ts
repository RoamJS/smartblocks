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
  getBlockUidsReferencingBlock,
  getPageTitleByBlockUid,
  parseRoamDate,
  getParentUidsOfBlockUid,
  BLOCK_REF_REGEX,
  getCurrentUserDisplayName,
  openBlock,
  getRoamUrl,
} from "roam-client";
import { parseDate } from "chrono-node";
import datefnsFormat from "date-fns/format";
import subDays from "date-fns/subDays";
import isBefore from "date-fns/isBefore";
import isAfter from "date-fns/isAfter";
import XRegExp from "xregexp";
import { renderPrompt } from "./Prompt";

export const PREDEFINED_REGEX = /#\d*-predefined/;
const PAGE_TITLE_REGEX = /^(?:#?\[\[(.*)\]\]|#([^\s]*))$/;
const DAILY_REF_REGEX = new RegExp(
  `#?\\[\\[(${DAILY_NOTE_PAGE_REGEX.source})\\]\\]`
);
const getDateFromText = (s: string) =>
  parseRoamDate(DAILY_REF_REGEX.exec(s)?.[1]);
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
      children: [{ text: `<%DATE:${text}%>` }],
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
const smartBlocksContext: {
  onBlockExit: CommandHandler;
  targetUid: string;
  ifCommand?: boolean;
  exitBlock: boolean;
  variables: Record<string, string>;
  cursorPosition?: { uid: string; selection: number };
  currentUid?: string;
  currentLength: 0;
  indent: Set<string>;
  unindent: Set<string>;
  focusOnBlock?: string;
} = {
  onBlockExit: () => "",
  targetUid: "",
  exitBlock: false,
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
    return Promise.resolve(new fcn(code)()).then((result) => {
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
      const date = parseDate(nlp);
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
    handler: (titleOrUid = "") => {
      const possibleTitle = extractTag(titleOrUid);
      const refUid = getPageUidByPageTitle(possibleTitle) || titleOrUid;
      const uids = getBlockUidsReferencingBlock(refUid);
      const uid = uids[Math.floor(Math.random() * uids.length)];
      return `((${uid}))`;
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
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = toRoamDate(new Date());
      const todos = blocks.filter(({ text }) => text.includes(today));
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
    handler: () => {
      return "";
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
            s.startsWith("-") ? !text.includes(s.substring(1)) : text
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
      const start = !undated && startArg ? parseDate(startArg) : new Date(0);
      const end =
        !undated && endArg ? parseDate(endArg) : new Date(9999, 11, 31);
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
            s.startsWith("-") ? !text.includes(s.substring(1)) : text
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
    help: "<b>FOCUSONBLOCK</b><br/>Will focus on the<br/>current block after the<br/>workflow finshes. ",
    handler: () => {
      smartBlocksContext.focusOnBlock = smartBlocksContext.currentUid;
      return "";
    },
  },
];
export const handlerByCommand = Object.fromEntries(
  COMMANDS.map((c) => [c.text, c.handler])
);

const breakTextToParts = (text: string) => {
  try {
    return XRegExp.matchRecursive(text, "<%", "%>", "g", {
      valueNames: ["text", null, "command", null],
      escapeChar: "\\",
    });
  } catch (e) {
    // use regular regex if XRegExp throws
    // https://github.com/slevithan/xregexp/issues/96
    let index = 0;
    const parts = [];
    const COMMAND_REGEX = /<%([A-Z0-9]*(?::.*?)?)%>/g;
    while (index < text.length) {
      const match = COMMAND_REGEX.exec(text);
      const endIndex = match ? match.index : text.length;
      parts.push({ value: text.substring(index, endIndex), name: "text" });
      if (match) {
        parts.push({ value: match[1], name: "command" });
        index = match.index + match[0].length;
      } else {
        index = endIndex;
      }
    }
    return parts.filter(({ value }) => !!value);
  }
};

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
) =>
  breakTextToParts(s).map((c) => () => {
    if (smartBlocksContext.exitBlock) {
      return Promise.resolve<InputTextNode[]>([{ text: "" }]);
    }
    if (c.name === "text") {
      return Promise.resolve<InputTextNode[]>([{ text: c.value }]);
    }
    const split = c.value.indexOf(":");
    const cmd = split < 0 ? c.value : c.value.substring(0, split);
    const args =
      split < 0
        ? []
        : c.value
            .substring(split + 1)
            .split(/(?<!\\),/)
            .map((s) => s.replace(/\\,/g, ","));
    const promiseArgs = args
      .map((r) => () => proccessBlockText(r))
      .reduce(
        (prev, cur) =>
          prev.then((argArray) =>
            cur().then(([{ text, children }, ...rest]) => {
              nextBlocks.push(...rest);
              currentChildren.push(...(children || []));
              argArray.push(text);
              return argArray;
            })
          ),
        Promise.resolve<string[]>([])
      );
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
  if (smartBlocksContext.exitBlock) {
    smartBlocksContext.exitBlock = false;
    return "";
  }

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
    await smartBlocksContext.onBlockExit();
    const processedChildren = await processChildren({
      nodes: n.children,
      nextBlocks,
    });
    return [
      {
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
  nextBlocks,
}: {
  nodes: InputTextNode[];
  introUid?: string;
  nextBlocks?: InputTextNode[];
}) =>
  processPromises(
    nodes.map((n, i) => (prev) => {
      const uid =
        (i === 0 && introUid) || window.roamAlphaAPI.util.generateUID();
      smartBlocksContext.currentUid = uid;
      smartBlocksContext.currentLength = 0;
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

const filterUselessBlocks = (blocks: InputTextNode[]): InputTextNode[] =>
  blocks
    .map((b) => ({
      ...b,
      children: b.children?.length
        ? filterUselessBlocks(b.children)
        : b.children,
    }))
    .filter((b) => !!b.text || !!b.children?.length);

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
  return processChildren({ nodes: childNodes, introUid: uid })
    .then(filterUselessBlocks)
    .then(([firstChild, ...tree]) => {
      const startingOrder = getOrderByBlockUid(uid);
      const parentUid = getParentUidByBlockUid(uid);
      const originalText = getTextByBlockUid(uid);
      updateBlock({
        uid,
        text: `${originalText.substring(0, start)}${
          firstChild?.text || ""
        }${originalText.substring(end)}`,
      });
      (firstChild?.children || []).forEach((node, order) =>
        createBlock({ order, parentUid: uid, node })
      );
      tree.forEach((node, i) =>
        createBlock({ parentUid, order: startingOrder + 1 + i, node })
      );
      if (smartBlocksContext.focusOnBlock) {
        setTimeout(() => {
          window.location.assign(getRoamUrl(smartBlocksContext.focusOnBlock));
        }, 1000);
      } else if (typeof mutableCursor === "boolean") {
        if (mutableCursor) {
          if (smartBlocksContext.cursorPosition) {
            if (
              smartBlocksContext.cursorPosition.uid === uid &&
              document.activeElement.tagName === "TEXTAREA" &&
              document.activeElement.id.endsWith(uid)
            ) {
              const selection =
                smartBlocksContext.cursorPosition.selection + start;
              setTimeout(
                () =>
                  (
                    document.activeElement as HTMLTextAreaElement
                  ).setSelectionRange(selection, selection),
                1
              );
            } else {
              new MutationObserver((mrs, obs) => {
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
              }).observe(document.body, { childList: true, subtree: true });
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
    });
};
