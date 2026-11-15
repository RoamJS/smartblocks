type ButtonMatch = {
  index: number;
  full: string;
  caption: string;
  body: string;
};

// Roam's parser consumes 5/4/3-backtick and inline code before macros.
// Keep separate source ranges: a macro cannot cross a rendered code span.
// See roamresearch.com/js/compiled/{shared,main,route-app}.js:
// the xparser token rule, LDa (code pairs), and czc (caption normalization).
export const getButtonMatches = (
  label: string,
  text: string
): ButtonMatch[] => {
  let ranges = [{ start: 0, text }];
  for (const delimiter of ["`````", "````", "```", "`"]) {
    ranges = ranges.flatMap(({ start, text }) => {
      const remaining: typeof ranges = [];
      let cursor = 0,
        open = text.indexOf(delimiter);
      while (open !== -1) {
        const close = text.indexOf(delimiter, open + delimiter.length);
        if (close === -1) break;
        remaining.push({
          start: start + cursor,
          text: text.slice(cursor, open),
        });
        cursor = close + delimiter.length;
        open = text.indexOf(delimiter, cursor);
      }
      remaining.push({ start: start + cursor, text: text.slice(cursor) });
      return remaining;
    });
  }
  const matches: ButtonMatch[] = [];
  for (const { start, text } of ranges) {
    let cursor = 0;
    while (/\{\{(?:(?!\{\{)[\s\S])+\}\}/.test(text.slice(cursor))) {
      // Like Roam's xparser, take the first balanced brace expression.
      let open = text.indexOf("{", cursor),
        end = -1;
      while (open !== -1 && end === -1) {
        let depth = 0;
        for (let i = open; i < text.length; i++) {
          if (text[i] === "{") depth++;
          if (text[i] === "}" && --depth === 0) {
            end = i + 1;
            break;
          }
        }
        if (end === -1) open = text.indexOf("{", open + 1);
      }
      if (end === -1) break;
      const full = text.slice(open, end);
      const body = full.substring(2, full.length - 2);
      const caption = body.trim().replace(/\s+/g, " ").split(":")[0];
      const name = caption.match(/\[\[([\s\S]*?)\]\]/)?.[1] ?? caption;
      const parts = name.split("/");
      const normalized = (
        name === "/" ? name : parts.length === 2 ? parts[1] : parts[0]
      ).trim();
      if (normalized === label.trim())
        matches.push({ index: start + open, full, caption: normalized, body });
      cursor = end;
    }
  }
  return matches;
};

export const parseSmartBlockButton = (
  label: string,
  text: string,
  occurrenceIndex: number = 0
): {
  index: number;
  full: string;
  buttonContent: string;
  buttonText: string;
  workflowName: string;
  variables: Record<string, string>;
} | null => {
  if (!Number.isInteger(occurrenceIndex) || occurrenceIndex < 0) return null;
  const match = getButtonMatches(label, text)[occurrenceIndex];
  if (!match) return null;
  const command = match.body.slice(match.body.indexOf(":") + 1);
  if (!/^(?:42)?SmartBlock:/.test(command)) return null;
  const { index, full, caption: buttonContent } = match;
  const buttonText = command.replace(/^(?:42)?SmartBlock:/, "");
  const colonIndex = buttonText.indexOf(":");
  const workflowName =
    colonIndex > -1 ? buttonText.substring(0, colonIndex) : buttonText;
  const args = colonIndex > -1 ? buttonText.substring(colonIndex + 1) : "";
  const variables = Object.fromEntries(
    args
      .replace(/\[\[[^\]]+\]\]|<%[^%]+%>/g, (m) =>
        m.replace(/,/g, "ESCAPE_COMMA")
      )
      .split(",")
      .filter((s) => !!s)
      .map((v) => v.replace(/ESCAPE_COMMA/g, ",").split("="))
      .map(([k, v = ""]) => [k, v])
  );
  variables["ButtonContent"] = buttonContent;
  return {
    index,
    full,
    buttonContent,
    buttonText,
    workflowName,
    variables,
  };
};

export default parseSmartBlockButton;
