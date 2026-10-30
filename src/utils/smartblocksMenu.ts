import fuzzy from "fuzzy";

export const PINNED_WORKFLOWS_SETTING = "pinned-workflow-uids";
export type MenuWorkflow = { uid: string; name: string };
export type MenuResult<T extends MenuWorkflow = MenuWorkflow> = T & {
  displayName: string;
  pinned: boolean;
};

export const readPinnedWorkflowUids = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(value.filter((uid): uid is string => typeof uid === "string")),
      )
    : [];

export const getMenuWorkflows = <T extends MenuWorkflow>({
  workflows,
  filter,
  pinnedUids,
}: {
  workflows: T[];
  filter: string;
  pinnedUids: string[];
}): MenuResult<T>[] => {
  const pins = new Set(pinnedUids);
  const results = filter
    ? fuzzy
        .filter(filter, workflows, {
          extract: (workflow) => workflow.name,
          pre: "<b>",
          post: "</b>",
        })
        .map(({ original, string }) => ({ ...original, displayName: string }))
    : workflows
        .filter((workflow) => pins.has(workflow.uid))
        .concat(workflows.filter((workflow) => !pins.has(workflow.uid)))
        .map((workflow) => ({ ...workflow, displayName: workflow.name }));
  return results
    .slice(0, 10)
    .map((workflow) => ({ ...workflow, pinned: pins.has(workflow.uid) }));
};

export const nextMenuIndex = ({
  index,
  count,
  direction,
}: {
  index: number;
  count: number;
  direction: 1 | -1;
}): number => (count ? (index + direction + count) % count : 0);

export type MenuKeyAction =
  | "next"
  | "previous"
  | "show-preview"
  | "hide-preview"
  | "source"
  | "run"
  | "close"
  | undefined;
export const getMenuKeyAction = ({
  key,
  ctrlKey,
  shiftKey,
  isComposing,
}: {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
}): MenuKeyAction => {
  if (isComposing) return undefined;
  if (key === "ArrowDown" || (ctrlKey && (key === "j" || key === "n")))
    return "next";
  if (key === "ArrowUp" || (ctrlKey && (key === "k" || key === "p")))
    return "previous";
  if (key === "ArrowRight") return "show-preview";
  if (key === "ArrowLeft") return "hide-preview";
  if (key === "Enter") return shiftKey ? "source" : "run";
  if (key === "Escape") return "close";
  return undefined;
};
