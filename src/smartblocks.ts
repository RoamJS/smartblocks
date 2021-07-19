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
} from "roam-client";
import { parseDate } from "chrono-node";
import datefnsFormat from "date-fns/format";
import subDays from "date-fns/subDays";
import isBefore from "date-fns/isBefore";
import addDays from "date-fns/addDays";
import isAfter from "date-fns/isAfter";
import { DAILY_NOTE_PAGE_TITLE_REGEX } from "roam-client/lib/date";
import { renderPrompt } from "./Prompt";

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
          text: "<%SET:ref,<%INPUT:Name of page or tag reference to search for?{page}%>%><%SEARCH:<%GET:ref%>%>",
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
    .map(({ uid }) => ({
      text: format
        .replace("{uid}", uid)
        .replace("{page}", getPageTitleByBlockUid(uid))
        .replace(
          "{path}",
          window.roamAlphaAPI
            .q(
              `[:find ?u :where [?p :block/uid ?u] [?e :block/parents ?p] [?e :block/uid "${uid}"]]`
            )
            .map((t) => `((${t[0]}))`)
            .reverse()
            .join(" > ")
        ),
    }));

type CommandOutput = string | string[] | InputTextNode[];
export type CommandHandler = (
  ...args: string[]
) => CommandOutput | Promise<CommandOutput>;
const smartBlocksContext: { onBlockExit: CommandHandler } = {
  onBlockExit: () => "",
};

const javascriptHandler: CommandHandler = (...args) => {
  const content = args.join(",");
  const code = content.replace(/^```javascript/, "").replace(/```$/, "");
  return Promise.resolve(new Function(code)()).then((result) => {
    if (typeof result === "undefined" || result === null) {
      return "";
    } else {
      return result.toString();
    }
  });
};

const COMMAND_REGEX = /<%([A-Z0-9]*)(?::(.*?))?%>/g;
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
      const dailyRegex = new RegExp(
        `\\[\\[(${DAILY_NOTE_PAGE_REGEX.source})\\]\\]`
      );
      const todos = blocks
        .filter(({ text }) => dailyRegex.test(text))
        .map(({ text, uid }) => ({
          text,
          uid,
          date: parseRoamDate(dailyRegex.exec(text)[1]),
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
      const dailyRegex = new RegExp(
        `\\[\\[(${DAILY_NOTE_PAGE_REGEX.source})\\]\\]`
      );
      const todos = blocks
        .map(({ text, uid }) => ({
          text,
          uid,
          date: dailyRegex.exec(text)?.[1] || getPageTitleByBlockUid(uid),
        }))
        .filter(({ date }) => DAILY_NOTE_PAGE_TITLE_REGEX.test(date))
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
      const dailyRegex = new RegExp(
        `\\[\\[(${DAILY_NOTE_PAGE_REGEX.source})\\]\\]`
      );
      const todos = blocks
        .filter(({ text }) => dailyRegex.test(text))
        .map(({ text, uid }) => ({
          text,
          uid,
          date: parseRoamDate(dailyRegex.exec(text)[1]),
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
      const dailyRegex = new RegExp(
        `\\[\\[(${DAILY_NOTE_PAGE_REGEX.source})\\]\\]`
      );
      const todos = blocks
        .map(({ text, uid }) => ({
          text,
          uid,
          date: dailyRegex.exec(text)?.[1] || getPageTitleByBlockUid(uid),
        }))
        .filter(({ date }) => DAILY_NOTE_PAGE_TITLE_REGEX.test(date))
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
      const dailyRegex = new RegExp(
        `\\[\\[(${DAILY_NOTE_PAGE_REGEX.source})\\]\\]`
      );
      const todos = blocks
        .filter(({ text }) => !dailyRegex.test(text))
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
    handler: javascriptHandler,
  },
  {
    text: "J",
    help: "Shortcut for Custom JavaScript code to run\n\n1. JavaScript code",
    handler: javascriptHandler,
  },
  {
    text: "JAVASCRIPTASYNC",
    help: "Custom asynchronous JavaScript code to run\n\n1. JavaScipt code",
    handler: javascriptHandler,
  },
  {
    text: "JA",
    help: "Shortcut for custom asynchronous JavaScript code to run\n\n1. JavaScipt code",
    handler: javascriptHandler,
  },
  {
    text: "ONBLOCKEXIT",
    help: "Asynchronous JavaScript code to <br/>run after a block has been<br/>processed by Roam42<br/>1. JavaScipt code<br/>Return value not processed",
    handler: (...args) => {
      smartBlocksContext.onBlockExit = () => javascriptHandler(...args);
      return "";
    },
  },
];
export const handlerByCommand = Object.fromEntries(
  COMMANDS.map((c) => [c.text, c.handler])
);

// ridiculous method names in this file are a tribute to the original author of SmartBlocks, RoamHacker 🙌
const proccessBlockWithSmartness = async (
  n: InputTextNode
): Promise<InputTextNode[]> => {
  try {
    const nextBlocks: InputTextNode[] = [];
    const currentChildren: InputTextNode[] = [];
    const promises: (() => Promise<InputTextNode[]>)[] = [];
    n.text.replace(COMMAND_REGEX, (orig, cmd, args) => {
      const promise = () => {
        const output = handlerByCommand[cmd]
          ? handlerByCommand[cmd](...(args ? args.split(",") : []))
          : orig;
        return typeof output === "string"
          ? Promise.resolve([{ text: output }])
          : Array.isArray(output)
          ? Promise.resolve(
              output.map((o: string | InputTextNode) =>
                typeof o === "string" ? { text: o } : o
              )
            )
          : output.then((text) =>
              typeof text === "string"
                ? [{ text }]
                : text.map((o: string | InputTextNode) =>
                    typeof o === "string" ? { text: o } : o
                  )
            );
      };
      promises.push(promise);
      return orig;
    });
    const data = await processPromises(promises);
    const text = n.text.replace(COMMAND_REGEX, () => {
      const blocks = data.shift();
      currentChildren.push(...(blocks[0]?.children || []));
      nextBlocks.push(...blocks.slice(1));
      return blocks[0]?.text || "";
    });
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
