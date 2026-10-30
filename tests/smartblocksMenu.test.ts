import { test, expect } from "@playwright/test";
import {
  getMenuWorkflows,
  getVisibleScrollTop,
  readPinnedWorkflowUids,
  nextMenuIndex,
  getMenuKeyAction,
} from "../src/utils/smartblocksMenu";

const workflows = [
  { uid: "a", name: "Agenda" },
  { uid: "b", name: "Meeting notes" },
  { uid: "c", name: "Meeting review" },
  { uid: "d", name: "Weekly review" },
];

test("pins are stable unique rows before the unchanged remainder", () => {
  const results = getMenuWorkflows({
    workflows,
    filter: "",
    pinnedUids: ["d", "b", "b", "missing"],
  });
  expect(results.map((w) => w.uid)).toEqual(["b", "d", "a", "c"]);
  expect(results.map((w) => w.pinned)).toEqual([true, true, false, false]);
  expect(workflows.map((w) => w.uid)).toEqual(["a", "b", "c", "d"]);
});
test("pins do not reorder fuzzy search or duplicate results", () => {
  const base = getMenuWorkflows({ workflows, filter: "meet", pinnedUids: [] });
  const pinned = getMenuWorkflows({
    workflows,
    filter: "meet",
    pinnedUids: ["c"],
  });
  expect(pinned.map((w) => w.uid)).toEqual(base.map((w) => w.uid));
  expect(pinned[0].displayName).toContain("<b>M</b>");
  expect(pinned.find((w) => w.uid === "c")?.pinned).toBe(true);
});
test("the ten-result cap still includes pins that were beyond the first ten", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    uid: String(i),
    name: `Workflow ${i}`,
  }));
  const results = getMenuWorkflows({
    workflows: many,
    filter: "",
    pinnedUids: ["19"],
  });
  expect(results).toHaveLength(10);
  expect(results[0].uid).toBe("19");
  expect(new Set(results.map((w) => w.uid)).size).toBe(10);
});
test("pins never reintroduce custom-only or hidden workflows excluded by the caller", () => {
  expect(
    getMenuWorkflows({
      workflows: [workflows[0]],
      filter: "",
      pinnedUids: ["b"],
    }).map((w) => w.uid),
  ).toEqual(["a"]);
});
test("empty results and malformed saved pins are safe", () => {
  expect(
    getMenuWorkflows({ workflows, filter: "zzzz", pinnedUids: ["b"] }),
  ).toEqual([]);
  expect(readPinnedWorkflowUids({ b: true })).toEqual([]);
  expect(readPinnedWorkflowUids(["a", 3, null, "a", "b"])).toEqual(["a", "b"]);
  expect(nextMenuIndex({ index: 0, count: 0, direction: 1 })).toBe(0);
});
test("keyboard navigation wraps in both directions", () => {
  expect(nextMenuIndex({ index: 0, count: 3, direction: -1 })).toBe(2);
  expect(nextMenuIndex({ index: 2, count: 3, direction: 1 })).toBe(0);
});

test("keyboard selections remain visible in a shortened results pane", () => {
  expect(
    getVisibleScrollTop({
      scrollTop: 0,
      viewportHeight: 160,
      itemTop: 300,
      itemHeight: 33,
    }),
  ).toBe(173);
  expect(
    getVisibleScrollTop({
      scrollTop: 173,
      viewportHeight: 160,
      itemTop: 5,
      itemHeight: 33,
    }),
  ).toBe(5);
  expect(
    getVisibleScrollTop({
      scrollTop: 100,
      viewportHeight: 160,
      itemTop: 120,
      itemHeight: 33,
    }),
  ).toBe(100);
  expect(
    getVisibleScrollTop({
      scrollTop: 0,
      viewportHeight: 90,
      itemTop: 100,
      itemHeight: 33,
    }),
  ).toBe(43);
});
test("preview and source shortcuts leave Enter and Ctrl navigation intact", () => {
  const action = (
    key: string,
    ctrlKey = false,
    shiftKey = false,
    isComposing = false,
  ) => getMenuKeyAction({ key, ctrlKey, shiftKey, isComposing });
  expect(action("ArrowRight")).toBe("show-preview");
  expect(action("ArrowLeft")).toBe("hide-preview");
  expect(action("Enter")).toBe("run");
  expect(action("Enter", false, true)).toBe("source");
  expect(action("Escape")).toBe("close");
  for (const key of ["j", "n"]) expect(action(key, true)).toBe("next");
  for (const key of ["k", "p"]) expect(action(key, true)).toBe("previous");
  expect(action("j")).toBeUndefined();
  expect(action("Enter", false, false, true)).toBeUndefined();
});
