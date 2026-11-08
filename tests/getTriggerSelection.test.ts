import { expect, test } from "@playwright/test";
import getTriggerSelection, {
  isCurrentTriggerSelection,
  resolveTrigger,
} from "../src/utils/getTriggerSelection";

test("uses the trigger occurrence nearest the cursor", () => {
  const prefix = "before jjmiddle ";
  const query = "jjworkflow";
  const text = `${prefix}${query} after`;
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

test("does not open the menu when the default trigger is typed inside a word", () => {
  for (const text of ["foojj", "foojjbar", "ñjjbar", "id_jjbar"]) {
    expect(
      getTriggerSelection({ text, selectionStart: text.length, trigger: "jj" })
    ).toBeUndefined();
  }
});

test("skips overlapping in-word matches when pasting a trigger and query", () => {
  const text = "jjjob";
  expect(
    getTriggerSelection({
      text,
      selectionStart: text.length,
      trigger: "jj",
      insertedLength: text.length,
    })
  ).toMatchObject({ start: 0, filter: "job" });
});

test("rejects earlier-line triggers, including a pinned menu trigger", () => {
  for (const newline of ["\n", "\r\n", "\r", "\u2028", "\u2029"]) {
    const text = `for jj = 1:num_alpha${newline}Take notes`;
    const input = { text, selectionStart: text.length, trigger: "jj" };
    const previousSelection = getTriggerSelection({ ...input, selectionStart: 6 });

    expect(previousSelection).toBeDefined();
    expect(getTriggerSelection(input)).toBeUndefined();
    expect(getTriggerSelection({ ...input, previousSelection })).toBeUndefined();
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
  const previousSelection = getTriggerSelection({
    text: "/daily suffix",
    selectionStart: 6,
    trigger: "/",
  });
  expect(
    getTriggerSelection({
      text: "/daily/plan suffix",
      selectionStart: 11,
      trigger: "/",
      previousSelection,
    })
  ).toEqual({
    text: "/daily/plan suffix",
    start: 0,
    end: 11,
    filter: "daily/plan",
  });
});

test("rejects execution when Ctrl+E moved the caret without input", () => {
  const text = "keep jj existing suffix";
  const trigger = "jj";
  const caret = 7;
  const selection = getTriggerSelection({ text, selectionStart: caret, trigger })!;
  expect(isCurrentTriggerSelection(selection, {
    value: text,
    selectionStart: caret,
    selectionEnd: caret,
  })).toBe(true);
  expect(isCurrentTriggerSelection(selection, {
    value: text,
    selectionStart: text.length,
    selectionEnd: text.length,
  })).toBe(false);
  expect(isCurrentTriggerSelection(selection, {
    value: text,
    selectionStart: caret,
    selectionEnd: text.length,
  })).toBe(false);

  const edited = `${text}x`;
  expect(getTriggerSelection({
    text: edited,
    selectionStart: edited.length,
    trigger,
    previousSelection: selection,
  })).toBeUndefined();
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
