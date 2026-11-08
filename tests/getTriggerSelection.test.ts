import { expect, test } from "@playwright/test";
import getTriggerSelection, {
  resolveTrigger,
} from "../src/utils/getTriggerSelection";

test("uses the trigger occurrence nearest the cursor", () => {
  expect(
    getTriggerSelection({
      text: "beforejjmiddlejjworkflow after",
      selectionStart: 24,
      trigger: "jj",
    })
  ).toEqual({
    text: "beforejjmiddlejjworkflow after",
    start: 14,
    end: 24,
    filter: "workflow",
  });
});

test("treats regular expression characters in a trigger literally", () => {
  expect(
    getTriggerSelection({
      text: "keep.*first.*second suffix",
      selectionStart: 19,
      trigger: ".*",
    })
  ).toEqual({
    text: "keep.*first.*second suffix",
    start: 11,
    end: 19,
    filter: "second",
  });
});

test("rejects earlier-line triggers, including a pinned menu trigger", () => {
  for (const newline of ["\n", "\r\n", "\r", "\u2028", "\u2029"]) {
    const text = `for jj = 1:num_alpha${newline}Take notes`;
    const input = { text, selectionStart: text.length, trigger: "jj" };

    expect(getTriggerSelection(input)).toBeUndefined();
    expect(getTriggerSelection({ ...input, triggerStart: 4 })).toBeUndefined();
  }
});

test("returns absolute splice offsets for the nearest trigger on a later line", () => {
  const prefix = "first jj line\nkeep jjold ";
  const query = "jjworkflow";
  const suffix = " suffix\nlast jj line";
  const text = `${prefix}${query}${suffix}`;

  expect(
    getTriggerSelection({
      text,
      selectionStart: prefix.length + query.length,
      trigger: "jj",
    })
  ).toEqual({
    text,
    start: prefix.length,
    end: prefix.length + query.length,
    filter: "workflow",
  });
});

test("opens on the second j without activating an earlier same-line trigger", () => {
  const prefix = "first jj stays\nkeep jjold ";
  const insert = (value: string, insertedLength = 1) =>
    getTriggerSelection({
      text: `${prefix}${value} suffix`,
      selectionStart: prefix.length + value.length,
      trigger: "jj",
      insertedLength,
    });

  expect(insert("j")).toBeUndefined();
  expect(insert("jj")).toMatchObject({ start: prefix.length, filter: "" });
  expect(insert("jjquery", 7)).toMatchObject({
    start: prefix.length,
    filter: "query",
  });
  expect(insert("jj", 0)).toBeUndefined();
});

test("keeps the trigger occurrence that opened the menu", () => {
  expect(
    getTriggerSelection({
      text: "/daily/plan suffix",
      selectionStart: 11,
      trigger: "/",
      triggerStart: 0,
    })
  ).toEqual({
    text: "/daily/plan suffix",
    start: 0,
    end: 11,
    filter: "daily/plan",
  });
});

test("returns a single text snapshot for the splice offsets", () => {
  const selection = getTriggerSelection({
    text: "keep this jjwrap suffix",
    selectionStart: 16,
    trigger: "jj",
  });
  expect(selection).toBeTruthy();
  expect(
    `${selection?.text.substring(0, selection.start)}${selection?.text.substring(
      selection.end
    )}`
  ).toBe("keep this  suffix");
});

test("an empty trigger is disabled", () => {
  const trigger = resolveTrigger({ legacyTrigger: "", value: "" });
  expect(trigger).toBe("");
  expect(
    getTriggerSelection({ text: "unchanged", selectionStart: 9, trigger })
  ).toBeUndefined();
});

test("defaults an unset trigger while preserving a legacy trigger", () => {
  expect(resolveTrigger({ legacyTrigger: "", value: undefined })).toBe("jj");
  expect(resolveTrigger({ legacyTrigger: " zz ", value: "new" })).toBe("zz");
});
