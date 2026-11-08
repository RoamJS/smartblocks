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
  triggerStart,
  insertedLength = Infinity,
}: {
  text: string;
  selectionStart: number;
  trigger: string;
  triggerStart?: number;
  insertedLength?: number;
}): TriggerSelection | undefined => {
  if (!trigger) return undefined;
  const valueToCursor = text.substring(0, selectionStart);
  const start = triggerStart ?? valueToCursor.lastIndexOf(trigger);
  const triggerEnd = start + trigger.length;
  return start < 0 ||
    triggerEnd <= selectionStart - insertedLength ||
    /[\r\n\u2028\u2029]/.test(valueToCursor.slice(start)) ||
    valueToCursor.substring(start, triggerEnd) !== trigger
    ? undefined
    : {
        text,
        start,
        end: selectionStart,
        filter: valueToCursor.substring(triggerEnd),
      };
};

export default getTriggerSelection;
