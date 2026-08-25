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
}: {
  text: string;
  selectionStart: number;
  trigger: string;
}): TriggerSelection | undefined => {
  if (!trigger) return undefined;
  const valueToCursor = text.substring(0, selectionStart);
  const start = valueToCursor.lastIndexOf(trigger);
  return start < 0
    ? undefined
    : {
        text,
        start,
        end: selectionStart,
        filter: valueToCursor.substring(start + trigger.length),
      };
};

export default getTriggerSelection;
