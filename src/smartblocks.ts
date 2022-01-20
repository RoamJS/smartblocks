import {
  DAILY_NOTE_PAGE_REGEX,
  DAILY_NOTE_PAGE_TITLE_REGEX,
} from "roamjs-components/date/constants";
import getOrderByBlockUid from "roamjs-components/queries/getOrderByBlockUid";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import createBlock from "roamjs-components/writes/createBlock";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { InputTextNode } from "roamjs-components/types";
import toRoamDate from "roamjs-components/date/toRoamDate";
import getBlockUidsAndTextsReferencingPage from "roamjs-components/queries/getBlockUidsAndTextsReferencingPage";
import getBlockUidsWithParentUid from "roamjs-components/queries/getBlockUidsWithParentUid";
import createTagRegex from "roamjs-components/util/createTagRegex";
import getAllBlockUids from "roamjs-components/queries/getAllBlockUids";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import extractRef from "roamjs-components/util/extractRef";
import extractTag from "roamjs-components/util/extractTag";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageTitleByBlockUid from "roamjs-components/queries/getPageTitleByBlockUid";
import parseRoamDate from "roamjs-components/date/parseRoamDate";
import getParentUidsOfBlockUid from "roamjs-components/queries/getParentUidsOfBlockUid";
import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import openBlock from "roamjs-components/dom/openBlock";
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
import * as chrono from "chrono-node";
import datefnsFormat from "date-fns/format";
import addDays from "date-fns/addDays";
import addWeeks from "date-fns/addWeeks";
import addMonths from "date-fns/addMonths";
import addYears from "date-fns/addYears";
import subDays from "date-fns/subDays";
import isBefore from "date-fns/isBefore";
import isAfter from "date-fns/isAfter";
import endOfDay from "date-fns/endOfDay";
import startOfDay from "date-fns/startOfDay";
import startOfWeek from "date-fns/startOfWeek";
import startOfMonth from "date-fns/startOfMonth";
import startOfYear from "date-fns/startOfYear";
import endOfWeek from "date-fns/endOfWeek";
import endOfMonth from "date-fns/endOfMonth";
import endOfYear from "date-fns/endOfYear";
import differenceInDays from "date-fns/differenceInDays";
import XRegExp from "xregexp";
import { renderPrompt } from "./Prompt";
import { render as renderToast } from "roamjs-components/components/Toast";
import { ParsingComponents } from "chrono-node/dist/results";
import { ORDINAL_WORD_DICTIONARY } from "./dom";
import { Intent, ToasterPosition } from "@blueprintjs/core";
import { renderLoading } from "./Loading";
import axios from "axios";
import lodashGet from "lodash/get";
import getUids from "roamjs-components/dom/getUids";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";

export const PREDEFINED_REGEX = /#\d*-predefined/;
const PAGE_TITLE_REGEX = /^(?:#?\[\[(.*)\]\]|#([^\s]*))$/;
const DAILY_REF_REGEX = new RegExp(
  `#?\\[\\[(${DAILY_NOTE_PAGE_REGEX.source})\\]\\]`
);
const getDateFromText = (s: string) =>
  parseRoamDate(DAILY_REF_REGEX.exec(s)?.[1]);
const getPageUidByBlockUid = (blockUid: string): string =>
  (
    window.roamAlphaAPI.q(
      `[:find (pull ?p [:block/uid]) :where [?e :block/uid "${blockUid}"] [?e :block/page ?p]]`
    )?.[0]?.[0] as { uid?: string }
  )?.uid || "";

const getDateBasisDate = () => {
  if (smartBlocksContext.dateBasisMethod === "DNP") {
    const title =
      getPageTitleByBlockUid(smartBlocksContext.targetUid) ||
      getPageTitleByPageUid(smartBlocksContext.targetUid);
    return DAILY_NOTE_PAGE_REGEX.test(title)
      ? parseRoamDate(title)
      : new Date();
  } else if (smartBlocksContext.dateBasisMethod) {
    return new Date(smartBlocksContext.dateBasisMethod);
  } else {
    return new Date();
  }
};

const ORDINAL_REGEX = new RegExp(
  `\\b(?:${Object.keys(ORDINAL_WORD_DICTIONARY)
    .sort((a, b) => b.length - a.length)
    .join("|")}|(?:[1-9])?[0-9](?:st|nd|rd|th)?)\\b`,
  "i"
);
const customDateNlp = new chrono.Chrono();
const DAYS_OFFSET = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thur: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};
const UPCOMING_PATTERN = new RegExp(
  "(\\W|^)" +
    "(?:(?:\\,|\\(|\\（)\\s*)?" +
    "(?:on\\s*?)?" +
    "upcoming\\s*" +
    "(" +
    Object.keys(DAYS_OFFSET).join("|") +
    ")" +
    "(?=\\W|$)",
  "i"
);
// https://github.com/wanasit/chrono/blob/d8da3c840c50c959a62a0840c9a627f39bc765df/src/parsers/en/ENWeekdayParser.js
customDateNlp.parsers.unshift({
  pattern: () => UPCOMING_PATTERN,
  extract: (context, match) => {
    const index = match.index + match[1].length;
    const text = match[0].substr(
      match[1].length,
      match[0].length - match[1].length
    );
    const result = context.createParsingResult(index, text);

    const dayOfWeek = match[2].toLowerCase();
    const offset = DAYS_OFFSET[dayOfWeek as keyof typeof DAYS_OFFSET];
    if (offset === undefined) {
      return null;
    }

    const startMoment = context.refDate;
    const refOffset = startMoment.getDay();
    result.start.assign("weekday", offset);
    if (offset <= refOffset) {
      startMoment.setDate(offset + 7 + startMoment.getDate() - refOffset);
      result.start.assign("day", startMoment.getDate());
      result.start.assign("month", startMoment.getMonth() + 1);
      result.start.assign("year", startMoment.getFullYear());
    } else {
      startMoment.setDate(offset + startMoment.getDate() - refOffset);
      result.start.imply("day", startMoment.getDate());
      result.start.imply("month", startMoment.getMonth() + 1);
      result.start.imply("year", startMoment.getFullYear());
    }

    return result;
  },
});
customDateNlp.parsers.push(
  {
    pattern: () => /\b((start|end) )?of\b/i,
    extract: () => ({}),
  },
  {
    pattern: () => ORDINAL_REGEX,
    extract: () => ({}),
  },
  {
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

export const HIDE_REGEX = /<%HIDE%>/;

export const getCustomWorkflows = () =>
  window.roamAlphaAPI
    .q(
      `[:find ?s ?u :where [?r :block/uid ?u] [?r :block/string ?s] [?r :block/refs ?p] (or [?p :node/title "SmartBlock"] [?p :node/title "42SmartBlock"])]`
    )
    .map(([text, uid]: string[]) => ({
      uid,
      name: text
        .replace(createTagRegex("SmartBlock"), "")
        .replace(createTagRegex("42SmartBlock"), "")
        .trim(),
    }));

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
  (format: string) =>
  ({ uid, text, title }: { uid: string; text?: string; title?: string }) => ({
    text: format
      .replace("{text}", text || getTextByBlockUid(uid))
      .replace("{uid}", uid)
      .replace("{page}", title || getPageTitleByBlockUid(uid))
      .replace(
        "{path}",
        getParentUidsOfBlockUid(uid)
          .reverse()
          .map((t, i) =>
            i === 0 ? `[[${getPageTitleByPageUid(t)}]]` : `((${t}))`
          )
          .join(" > ")
      )
      .replace(/{attr:([^}:]*)(?::([^}]*))?}/, (_, name, format = "VALUE") => {
        const value = (
          window.roamAlphaAPI
            .q(
              `[:find (pull ?b [:block/string]) :where [?r :node/title "${normalizePageTitle(
                name
              )}"] [?t :block/uid "${uid}"] [?b :block/refs ?r] [?b :block/page ?p] [?t :block/page ?p]]]`
            )
            .find((a) => new RegExp(`^${name}::`).test(a?.[0]?.string))?.[0]
            ?.string || ""
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
  dateBasisMethod?: string;
  refMapping: Record<string, string>;
  afterWorkflowMethods: (() => void | Promise<void>)[];
};

export const smartBlocksContext: SmartBlocksContext = {
  onBlockExit: () => "",
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
};
const resetContext = (context: Partial<SmartBlocksContext>) => {
  smartBlocksContext.onBlockExit = context.onBlockExit || (() => "");
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
  smartBlocksContext.dateBasisMethod = context.dateBasisMethod;
  smartBlocksContext.refMapping = context.refMapping || {};
  smartBlocksContext.afterWorkflowMethods = context.afterWorkflowMethods || [];
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
    const justVariables = Object.entries(smartBlocksContext.variables)
      .map(([k, v]) => [k.replace(/^\d+/, ""), v])
      .filter(([s]) => !!s);
    const variables = smartBlocksContext.dateBasisMethod
      ? justVariables.concat([
          "DATEBASISMETHOD",
          smartBlocksContext.dateBasisMethod,
        ])
      : justVariables;
    return Promise.resolve(
      new fcn(...variables.map((v) => v[0]), code)(
        ...variables.map((v) => v[1])
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

const stripUids = ({
  uid,
  children,
  ...rest
}: InputTextNode): InputTextNode => ({
  ...rest,
  children: children.map(stripUids),
});

export const COMMANDS: {
  text: string;
  help: string;
  delayArgs?: true;
  handler: CommandHandler;
}[] = [
  {
    text: "DATE",
    help: "Returns a Roam formatted dated page reference.\n\n1: NLP expression\n\n2: optional: format for returned date, example: YYYY-MM-DD",
    handler: (nlp, ...format) => {
      if (!nlp) {
        return `[[${toRoamDate(
          customDateNlp.parseDate("today", getDateBasisDate())
        )}]]`;
      }
      const date =
        customDateNlp.parseDate(nlp, getDateBasisDate()) ||
        // chrono fails basic parsing requiring forward date if ambiguous
        // https://github.com/wanasit/chrono/commit/4f264a9f21fbd04eb740bf48f5616f6e6e0e78b7
        customDateNlp.parseDate(`in ${nlp}`, getDateBasisDate());
      if (!date) {
        return `Could not return a valid date with text "${nlp}"`;
      }
      if (format.length) {
        return datefnsFormat(date, format.join(","), {
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
    handler: (nlp) => {
      const dt = nlp
        ? customDateNlp.parseDate(nlp, getDateBasisDate()) ||
          // chrono fails basic parsing requiring forward date if ambiguous
          // https://github.com/wanasit/chrono/commit/4f264a9f21fbd04eb740bf48f5616f6e6e0e78b7
          customDateNlp.parseDate(`in ${nlp}`, getDateBasisDate())
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
        ? customDateNlp.parseDate(nlp, getDateBasisDate()) ||
          // chrono fails basic parsing requiring forward date if ambiguous
          // https://github.com/wanasit/chrono/commit/4f264a9f21fbd04eb740bf48f5616f6e6e0e78b7
          customDateNlp.parseDate(`in ${nlp}`, getDateBasisDate())
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
      const refUids = args
        .map((titleOrUid) => ({
          titleOrUid: titleOrUid.replace(/^-/, ""),
          excludes: /^-/.test(titleOrUid),
        }))
        .map(({ titleOrUid, excludes }) => {
          const possibleTitle = extractTag(titleOrUid);
          return {
            uid: getPageUidByPageTitle(possibleTitle) || titleOrUid,
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
    help: "Returns a random child block from a block references a page\n\n1: Page name or UID.",
    handler: (titleOrUid = "") => {
      const possibleTitle = extractTag(titleOrUid);
      const parentUid = getPageUidByPageTitle(possibleTitle) || titleOrUid;
      const uids = window.roamAlphaAPI
        .q(
          `[:find (pull ?c [:block/uid]) :where [?b :block/uid "${parentUid}"] [?r :block/refs ?b] [?c :block/parents ?r]]`
        )
        .map((r) => r[0]?.uid as string);
      const uid = uids[Math.floor(Math.random() * uids.length)];
      return uids.length ? `((${uid}))` : "No blocks on page!";
    },
  },
  {
    text: "TODOTODAY",
    help: "Returns a list of block refs of TODOs for today\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const today = toRoamDate(
        customDateNlp.parseDate("today", getDateBasisDate())
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
        .map(([uid, text]) => ({ uid, text }));
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOOVERDUE",
    help: "Returns a list of block refs of TODOs that are Overdue\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = startOfDay(
        customDateNlp.parseDate("today", getDateBasisDate())
      );
      const todos = blocks
        .filter(({ text }) => DAILY_REF_REGEX.test(text))
        .map(({ text, uid }) => ({
          text,
          uid,
          date: parseRoamDate(DAILY_REF_REGEX.exec(text)[1]),
        }))
        .filter(({ date }) => isBefore(date, today))
        .sort(({ date: a }, { date: b }) => a.valueOf() - b.valueOf());
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOOVERDUEDNP",
    help: "Returns a list of block refs of TODOs that are Overdue including DNP TODOs\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = startOfDay(
        customDateNlp.parseDate("today", getDateBasisDate())
      );
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
        .filter(({ date }) => isBefore(date, today))
        .sort(({ date: a }, { date: b }) => a.valueOf() - b.valueOf());
      return outputTodoBlocks(todos, ...args);
    },
  },
  {
    text: "TODOFUTURE",
    help: "Returns a list of block refs of TODOs that are due in the future\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = customDateNlp.parseDate("today", getDateBasisDate());
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
    help: "Returns a list of block refs of TODOs that are due in the future including DNP TODOs\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = getBlockUidsAndTextsReferencingPage("TODO");
      const today = customDateNlp.parseDate("today", getDateBasisDate());
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
    help: "Returns a list of block refs of TODOs with no date\n\n1. Max # blocks\n\n2. Format of output.\n\n3. optional filter values",
    handler: (...args) => {
      const blocks = window.roamAlphaAPI
        .q(
          `[:find (pull ?r [:block/uid :block/string]) (pull ?t [:node/title]) :where [?p :node/title "TODO"] [?r :block/refs ?p] [?r :block/page ?t]]`
        )
        .map(
          ([
            { uid, string = "" },
            p, // could be null
          ]: Record<string, string>[]) => ({
            uid,
            text: string,
            title: p.title,
          })
        );
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
    help: "Prompts user for input which will then be inserted into block\n\n1: text to display in prompt. Add a @@ followed by text for a default value",
    handler: async (...args) => {
      const [display, initialValue, ...options] = args.join("%%").split("%%");
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
    help: "Returns list of blocks mentioned based on date range\n\n1: Max blocks to return\n\n2: Page or Tag Name\n\n3: Start Date\n\n4. End Date\n\n5: Sort (ASC,DESC,NONE)\n\n6:Format of Output\n\n7: (opt) filtering ",
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
        !undated && startArg
          ? startOfDay(customDateNlp.parseDate(startArg, referenceDate))
          : new Date(0);
      const end =
        !undated && endArg
          ? endOfDay(customDateNlp.parseDate(endArg, referenceDate))
          : new Date(9999, 11, 31);
      const limit = Number(limitArg);
      const title = extractTag(titleArg);
      const results = window.roamAlphaAPI
        .q(
          `[:find (pull ?r [:block/uid :block/string]) (pull ?t [:node/title]) :where [?p :node/title "${normalizePageTitle(
            title
          )}"] [?r :block/refs ?p] [?r :block/page ?t]]`
        )
        .map(
          ([{ string: text, uid }, { title }]: Record<string, string>[]) => ({
            text,
            uid,
            title,
          })
        )
        .filter(({ text, title }) => {
          const ref =
            DAILY_REF_REGEX.exec(text)?.[1] ||
            DAILY_NOTE_PAGE_TITLE_REGEX.exec(title)?.[0];
          if (ref) {
            const d = parseRoamDate(ref);
            return !undated && !isBefore(d, start) && !isAfter(d, end);
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
    help: "Evaluates a condition for true. Use with THEN & ELSE.\n\n1: Logic to be evaluated\n\n2: (Optional) Value if true\n\n3: (Optional) Value if false",
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
    delayArgs: true,
    help: "Used with IF when IF is true\n\n1: Text to be inserted",
    handler: (...args: string[]) => {
      if (smartBlocksContext.ifCommand) {
        smartBlocksContext.ifCommand = undefined;
        return proccessBlockText(args.join(","));
      }
      return "";
    },
  },
  {
    text: "ELSE",
    help: "Used with IF when IF is false\n\n1: Text to be inserted",
    handler: (...args: string[]) => {
      if (smartBlocksContext.ifCommand === false) {
        smartBlocksContext.ifCommand = undefined;
        return args.join(",");
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
          smartBlocksContext.exitBlock = "yes";
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
      const today = customDateNlp.parseDate("today", getDateBasisDate());
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
      const today = customDateNlp.parseDate("today", getDateBasisDate());
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
      const today = customDateNlp.parseDate("today", getDateBasisDate());
      const match = dates
        .map((s) => s.trim())
        .map((s) => (s === "7" ? 0 : Number(s)))
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
        `[:find ?b :where [?p :block/uid "${uid}"] [?b :block/refs ?p] [?b :block/uid ${blockUid}]]`
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
    text: "GET",
    help: "Returns a variable\n\n1. Variable name",
    handler: (name = "") => {
      if (!name) return "--> Variable name required for GET <--";
      return typeof smartBlocksContext.variables[name] === "undefined"
        ? `--> Variable ${name} not SET <--`
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
        uid: smartBlocksContext.currentUid,
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
          : smartBlocksContext.currentUid;
      if (name) {
        smartBlocksContext.variables[name] = ref;
        return "";
      }
      return ref;
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
        .map(getFormatter(format));
    },
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
          return toRoamDate(
            addDays(parseRoamDate(extractTag(a)), Number(b) || 0)
          );
        } else if (isBDate) {
          return toRoamDate(
            addDays(parseRoamDate(extractTag(b)), Number(a) || 0)
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
          parseRoamDate(extractTag(minuend)),
          parseRoamDate(extractTag(subtrahend))
        ).toString();
      } else if (isMinDate) {
        return toRoamDate(
          subDays(parseRoamDate(extractTag(minuend)), Number(subtrahend) || 0)
        );
      } else if (isSubDate) {
        return toRoamDate(
          subDays(parseRoamDate(extractTag(subtrahend)), Number(minuend) || 0)
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
    handler: () => {
      return navigator.clipboard.readText();
    },
  },
  {
    text: "SMARTBLOCK",
    help: "Runs another SmartBlock\n\n1. SmartBlock name\n\n2. Optional page name to execute the workflow remotely",
    handler: (inputName = "", ...pageName) => {
      const srcUid = getCleanCustomWorkflows().find(
        ({ name }) => name === inputName.trim()
      )?.uid;
      if (srcUid) {
        if (pageName.length) {
          const title = extractTag(pageName.join(","));
          const targetUid = getPageUidByPageTitle(title);
          return (
            targetUid ? Promise.resolve(targetUid) : createPage({ title })
          ).then((targetUid) => {
            const parentContext = { ...smartBlocksContext };
            return sbBomb({
              srcUid,
              target: { uid: targetUid, isPage: true },
              variables: smartBlocksContext.variables,
            }).then(() => {
              resetContext(parentContext);
              return "";
            });
          });
        }
        const nodes = getFullTreeByParentUid(srcUid).children;
        return processChildren({
          nodes,
          introUid: smartBlocksContext.currentUid,
          introContent: smartBlocksContext.currentContent,
        });
      } else {
        renderToast({
          id: "roamjs-smartblocks-warning",
          content: `${inputName.trim()} is not a valid Roam42 SmartBlock`,
        });
        return `---- SmartBlock:  **${inputName.trim()}**  does not exist. ----`;
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
      smartBlocksContext.dateBasisMethod = undefined;
      smartBlocksContext.dateBasisMethod =
        mode === "DNP" ? mode : chrono.parseDate(mode).toJSON();
      return "";
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
      const pageOrUid =
        smartBlocksContext.variables[pageOrUidArg] || pageOrUidArg;
      const uid =
        getPageUidByPageTitle(extractTag(pageOrUid)) || extractRef(pageOrUid);
      const refsToCreate = new Set(
        Object.values(smartBlocksContext.refMapping)
      );
      return (
        !getPageTitleByPageUid(uid) &&
        !getTextByBlockUid(uid) &&
        !refsToCreate.has(uid)
          ? createPage({ title: pageOrUid })
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
          return;
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
      const pageOrUidArg = (afterNavArg ? args.slice(0, -1) : args)
        .join(",")
        .trim();
      const pageOrUid =
        smartBlocksContext.variables[pageOrUidArg] || pageOrUidArg;
      const uid =
        getPageUidByPageTitle(extractTag(pageOrUid)) || extractRef(pageOrUid);
      const refsToCreate = new Set(
        Object.values(smartBlocksContext.refMapping)
      );
      return (
        !getPageTitleByPageUid(uid) &&
        !getTextByBlockUid(uid) &&
        !refsToCreate.has(uid)
          ? createPage({ title: pageOrUid })
          : Promise.resolve(uid)
      ).then((navUid) => {
        const openInSidebar = () =>
          window.roamAlphaAPI.ui.rightSidebar.open().then(() => {
            if (/GRAPH/.test(afterNavArg)) {
              return window.roamAlphaAPI.ui.rightSidebar.addWindow({
                window: { type: "graph", "block-uid": navUid },
              });
            } else if (/GOTOBLOCK/.test(afterNavArg)) {
              const blockNumber =
                Number(afterNavArg.replace(/GOTOBLOCK/, "").trim()) || 1;
              const blocks = Array.from(
                document.querySelectorAll<HTMLDivElement>(
                  ".sidebar-content>div:first-child .rm-block-text"
                )
              );
              const index =
                blockNumber > 0 ? blockNumber - 1 : blocks.length + blockNumber;
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
      });
    },
  },
  {
    text: "SIDEBARWINDOWCLOSE",
    help: "Closes sidebar pane\n\n1. number of side pane to close. Use 0 to close all panes.",
    handler: (numberArg = "0") => {
      const count = Number(numberArg) || 0;
      const windows = window.roamAlphaAPI.ui.rightSidebar.getWindows();
      if (count <= 0) {
        window.roamAlphaAPI.ui.rightSidebar.close();
      } else if (count <= windows.length) {
        window.roamAlphaAPI.ui.rightSidebar.removeWindow({
          // @ts-ignore broken api
          window: windows[count],
        });
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
        : new RegExp(reg, flags);
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
      const normRef = smartBlocksContext.variables[ref] || ref;
      const text = rest.join(",");
      const normOut = smartBlocksContext.variables[text] || text;
      const uid = extractRef(normRef);
      updateBlock({ uid, text: normOut });
      return "";
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
      return axios.get(url).then((r) => {
        if (field) {
          return output(lodashGet(r.data, field.trim()));
        }
        return output(r.data);
      });
    },
  },
  {
    text: "CHILDREN",
    help: "Gets the block tree nested under the input block reference\n\n1. Block reference",
    handler: (text) => {
      const normText = smartBlocksContext.variables[text] || text;
      const uid = extractRef(normText);
      return getBasicTreeByParentUid(uid).map(stripUids);
    },
  },
];
export const handlerByCommand = Object.fromEntries(
  COMMANDS.map(({ text, help, ...rest }) => [text, rest])
);

const proccessBlockText = async (s: string): Promise<InputTextNode[]> => {
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
    console.error(e);
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
    const { handler, delayArgs } = handlerByCommand[cmd] || {};
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
                  delete nodeProps.children;
                  delete nodeProps.uid;
                  delete nodeProps.text;
                  return { ...prev, ...nodeProps };
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
          : output.map((o: string | InputTextNode) =>
              typeof o === "string" ? { text: o, ...nodeProps } : o
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
const proccessBlockWithSmartness = async (
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
    await smartBlocksContext.onBlockExit();
    const processedChildren = await processChildren({
      nodes: n.children,
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
    console.error(e);
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
        (i === 0 && introUid) || window.roamAlphaAPI.util.generateUID();
      smartBlocksContext.refMapping[n.uid] = uid;
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

const resolveRefs = (nodes: InputTextNode[]): InputTextNode[] =>
  nodes.map((node) => ({
    ...node,
    text: node.text.replace(
      BLOCK_REF_REGEX,
      (_, ref) => `((${smartBlocksContext.refMapping[ref] || ref}))`
    ),
    children: resolveRefs(node.children || []),
  }));

const count = (t: InputTextNode[]): number =>
  t.map((c) => count(c.children) + 1).reduce((p, c) => p + c, 0);

export const sbBomb = async ({
  srcUid,
  target: { uid, start = 0, end = start, isPage = false, windowId },
  variables = {},
  mutableCursor,
  triggerUid = uid,
}: {
  srcUid: string;
  target: {
    uid: string;
    start?: number;
    end?: number;
    isPage?: boolean;
    windowId?: string;
  };
  variables?: Record<string, string>;
  mutableCursor?: boolean;
  triggerUid?: string;
}): Promise<number> => {
  const finish = renderLoading(uid);
  resetContext({ targetUid: uid, variables, triggerUid });
  const childNodes = PREDEFINED_REGEX.test(srcUid)
    ? predefinedChildrenByUid[srcUid]
    : getFullTreeByParentUid(srcUid).children;
  const props: { introUid?: string; introContent?: string; suffix?: string } =
    {};
  if (!isPage) {
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
      const numNodes = count(tree);
      if (numNodes >= 300) {
        renderToast({
          intent: Intent.WARNING,
          id: "smartblocks-limit",
          content:
            "This workflow outputs more than 300 blocks which is Roam's limit. Reach out to support@roamjs.com if this applies to you",
        });
      }
      if (firstChild) {
        const startingOrder = isPage
          ? getChildrenLengthByPageUid(uid)
          : getOrderByBlockUid(uid);
        const parentUid = isPage ? uid : getParentUidByBlockUid(uid);
        if (isPage) {
          await createBlock({
            node: firstChild,
            parentUid,
            order: startingOrder,
          });
        } else {
          const textPostProcess = getTextByBlockUid(uid);
          const indexDiffered = textPostProcess
            .split("")
            .findIndex((c, i) => c !== props.introContent.charAt(i));
          await Promise.all([
            updateBlock({
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
            }),
            ...firstChild.children.map((node, order) =>
              createBlock({ order, parentUid: uid, node })
            ),
          ]);
        }
        await Promise.all(
          next.map((node, i) =>
            createBlock({
              parentUid,
              order: startingOrder + 1 + i,
              node,
            })
          )
        );
      }
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
        } else if (document.activeElement.tagName === "TEXTAREA") {
          (document.activeElement as HTMLTextAreaElement).blur();
        }
      }
      return tree.length;
    })
    .then((c) =>
      Promise.all(smartBlocksContext.afterWorkflowMethods.map((w) => w()))
        .catch((e) => console.error(e))
        .then(() => c)
    )
    .finally(finish);
};
