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
          text: "<%SET:ref,<%INPUT:Name of page or tag reference to search for?{page}%>%><%BLOCKMENTIONS:<%GET:ref%>%>",
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
const smartBlocksContext: { onBlockExit: CommandHandler; targetUid: string } = {
  onBlockExit: () => "",
  targetUid: "",
};
const resetContext = (targetUid: string) => {
  smartBlocksContext.onBlockExit = () => "";
  smartBlocksContext.targetUid = targetUid;
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
      return `((${uid}))`;
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
    help: "Returns a list of parent block refs to a given block ref\n\n1: Block reference\n2: Separator used between blok references",
    handler: (uidArg = "", ...delim) => {
      const separator = delim.join(",") || " > ";
      const uid = uidArg.replace(/^(\+|-)/, "");
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
      return args.map((s) => s.replace(/\\,/g, ",")).join("");
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

// ridiculous method names in this file are a tribute to the original author of SmartBlocks, RoamHacker 🙌
const proccessBlockWithSmartness = async (
  n: InputTextNode
): Promise<InputTextNode[]> => {
  try {
    const nextBlocks: InputTextNode[] = [];
    const currentChildren: InputTextNode[] = [];
    const promises: (() => Promise<InputTextNode[]>)[] = [];
    const parts = breakTextToParts(n.text);
    parts
      .filter((p) => p.name === "command")
      .forEach((c) => {
        const split = c.value.indexOf(":");
        const cmd = split < 0 ? c.value : c.value.substring(0, split);
        const args =
          split < 0 ? [] : c.value.substring(split + 1).split(/(?<!\\),/);
        const promise = () => {
          const promiseArgs = args
            .map((r) =>
              proccessBlockWithSmartness({ text: r }).then(
                ([{ text, children }, ...rest]) => {
                  nextBlocks.push(...rest);
                  currentChildren.push(...(children || []));
                  return text;
                }
              )
            )
            .reduce(
              (prev, cur) =>
                prev.then((argArray) =>
                  cur.then((arg) => argArray.push(arg)).then(() => argArray)
                ),
              Promise.resolve<string[]>([])
            );
          return promiseArgs
            .then((resolvedArgs) =>
              handlerByCommand[cmd]
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
        };
        promises.push(promise);
      });
    const data = await processPromises(promises);

    const text = parts
      .map(({ name, value }) => {
        if (name === "text") {
          return value;
        }
        const blocks = data.shift();
        currentChildren.push(...(blocks[0]?.children || []));
        nextBlocks.push(...blocks.slice(1));
        return blocks[0]?.text || "";
      })
      .join("");
    await smartBlocksContext.onBlockExit();
    return [
      {
        text,
        children: [...currentChildren, ...(await processChildren(n.children))],
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

const processPromises = (nodes: (() => Promise<InputTextNode[]>)[] = []) =>
  nodes.reduce(
    (prev, cur) =>
      prev.then((r) =>
        cur().then((c) => {
          r.push(c);
          return r;
        })
      ),
    Promise.resolve([] as InputTextNode[][])
  );

const processChildren = (nodes: InputTextNode[] = []) =>
  processPromises(nodes.map((n) => () => proccessBlockWithSmartness(n))).then(
    (results) => results.flatMap((r) => r)
  );

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
}: {
  srcUid: string;
  target: { uid: string; start: number; end: number };
}): Promise<void> => {
  resetContext(uid);
  const childNodes = PREDEFINED_REGEX.test(srcUid)
    ? predefinedChildrenByUid[srcUid]
    : getTreeByBlockUid(srcUid).children;
  return processChildren(childNodes)
    .then(filterUselessBlocks)
    .then(([firstChild, ...tree]) => {
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
    });
};
