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
