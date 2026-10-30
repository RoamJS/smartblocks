const MONTH_DAY_REGEX =
  /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?$/i;
const YEAR_REGEX = /^\d{4}$/;

/**
 * Re-joins "Month Day, Year" date tokens that were split on commas.
 *
 * BLOCKMENTIONSDATED signature: (limit, title, startDate, endDate, sort, format, ...search)
 * Positions 0-1 (limit, title) are passed through unchanged.
 * Starting at position 2, up to 2 date tokens are coalesced (startDate + endDate).
 * The `mergedDates < 2` guard stops coalescing after both date slots are filled.
 */
const coalesceBlockMentionsDatedDates = (args: string[]) => {
  const merged = args.slice(0, 2);
  let i = 2;
  let mergedDates = 0;
  while (i < args.length) {
    const current = args[i] || "";
    const next = args[i + 1];
    if (
      mergedDates < 2 &&
      typeof next === "string" &&
      MONTH_DAY_REGEX.test(current.trim()) &&
      YEAR_REGEX.test(next.trim())
    ) {
      merged.push(`${current.trimEnd()}, ${next.trimStart()}`);
      i += 2;
      mergedDates += 1;
    } else {
      merged.push(current);
      i += 1;
    }
  }
  return merged;
};

const splitSmartBlockArgs = (cmd: string, afterColon: string) => {
  let commandStack = 0;
  let pageRefStack = 0;
  const args = [] as string[];
  for (let i = 0; i < afterColon.length; i += 1) {
    const cur = afterColon[i];
    const prev = afterColon[i - 1];
    const next = afterColon[i + 1];
    if (cur === "%" && prev === "<") {
      commandStack += 1;
    } else if (cur === "%" && next === ">" && commandStack) {
      commandStack -= 1;
    } else if (cur === "[" && next === "[") {
      pageRefStack += 1;
    } else if (cur === "]" && prev === "]" && pageRefStack) {
      pageRefStack -= 1;
    }
    if (cur === "," && !commandStack && !pageRefStack && prev !== "\\") {
      args.push("");
      continue;
    } else if (cur === "\\" && next === ",") {
      continue;
    }
    const current = args[args.length - 1] || "";
    if (!args.length) {
      args.push(cur);
    } else {
      args[args.length - 1] = `${current}${cur}`;
    }
  }
  return cmd.toUpperCase() === "BLOCKMENTIONSDATED"
    ? coalesceBlockMentionsDatedDates(args)
    : args;
};

export default splitSmartBlockArgs;
