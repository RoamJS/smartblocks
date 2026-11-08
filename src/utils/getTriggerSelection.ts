export type TriggerSelection = {
  text: string;
  start: number;
  end: number;
  filter: string;
};

export const resolveTrigger = ({
  legacyTrigger,
  value,
}: {
  legacyTrigger: string;
  value: unknown;
}): string =>
  (legacyTrigger || (typeof value === "string" ? value : "jj"))
    .replace(/"/g, "")
    .trim();

const getTriggerSelection = ({
  text,
  selectionStart,
  trigger,
  previousSelection,
  insertedLength = Infinity,
}: {
  text: string;
  selectionStart: number;
  trigger: string;
  previousSelection?: TriggerSelection;
  insertedLength?: number;
}): TriggerSelection | undefined => {
  if (!trigger) return undefined;
  const valueToCursor = text.substring(0, selectionStart);
  let start = previousSelection?.start ?? valueToCursor.lastIndexOf(trigger);
  // A word-like trigger can start a word, but must not fire inside one.
  if (!previousSelection && /^[\p{L}\p{M}\p{N}_]/u.test(trigger)) {
    while (start > 0 && /[\p{L}\p{M}\p{N}_]$/u.test(valueToCursor.slice(0, start))) {
      start = valueToCursor.lastIndexOf(trigger, start - 1);
    }
  }
  const triggerEnd = start + trigger.length;
  if (
    start < 0 ||
    triggerEnd <= selectionStart - insertedLength ||
    /[\r\n\u2028\u2029]/.test(valueToCursor.slice(start)) ||
    valueToCursor.substring(start, triggerEnd) !== trigger
  ) {
    return undefined;
  }

  // Input can update the query, but must not pull surrounding text into it.
  if (
    previousSelection &&
    (previousSelection.text.slice(0, start) !== text.slice(0, start) ||
      previousSelection.text.slice(previousSelection.end) !==
        text.slice(selectionStart))
  ) {
    return undefined;
  }

  return {
    text,
    start,
    end: selectionStart,
    filter: valueToCursor.substring(triggerEnd),
  };
};

export const isCurrentTriggerSelection = (
  selection: TriggerSelection,
  editor: Pick<HTMLTextAreaElement, "value" | "selectionStart" | "selectionEnd">
): boolean =>
  editor.value === selection.text &&
  editor.selectionStart === selection.end &&
  editor.selectionEnd === selection.end;

export default getTriggerSelection;
