export const parseSmartBlockButton = (
  label: string,
  text: string,
  occurrenceIndex: number = 0
):
  | {
      index: number;
      full: string;
      buttonContent: string;
      buttonText: string;
      workflowName: string;
      variables: Record<string, string>;
    }
  | null => {
  const trimmedLabel = label.trim();
  const buttonRegex = trimmedLabel
    ? new RegExp(
        `{{(${trimmedLabel.replace(/\\+/g, "\\+")}):(?:42)?SmartBlock:(.*?)}}`,
        "g"
      )
    : /{{\s*:(?:42)?SmartBlock:(.*?)}/g;

  // Find all matches
  const matches = Array.from(text.matchAll(buttonRegex));
  if (matches.length === 0 || occurrenceIndex >= matches.length) return null;

  const match = matches[occurrenceIndex];
  if (!match) return null;
  const index = match.index;
  const full = match[0];
  const buttonContent = trimmedLabel ? match[1] || "" : "";
  const buttonText = trimmedLabel ? match[2] : match[1];
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
