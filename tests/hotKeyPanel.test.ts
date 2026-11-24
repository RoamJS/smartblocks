import { test, expect } from "@playwright/test";
import { createAddHotKeyUpdater } from "../src/utils/createAddHotKeyUpdater";
import getNextAvailableHotKey from "../src/utils/getNextAvailableHotKey";

test("picks next control hotkey when control+o is taken", () => {
  expect(getNextAvailableHotKey({ "control+o": "uid-1" })).toBe("control+p");
});

test("falls back to alt hotkeys when control combos are exhausted", () => {
  const taken = Object.fromEntries(
    "opklijuyhgfdsawertqzxcvbnm1234567890"
      .split("")
      .map((k, i) => [`control+${k}`, `uid-${i}`])
  );
  expect(getNextAvailableHotKey(taken)).toBe("alt+o");
});

test("throws when all modifier+suffix combos are exhausted", () => {
  const allTaken: Record<string, string> = {};
  for (const mod of ["control", "alt", "shift", "meta"]) {
    for (const key of "opklijuyhgfdsawertqzxcvbnm1234567890".split("")) {
      allTaken[`${mod}+${key}`] = `uid-${mod}-${key}`;
    }
  }
  expect(() => getNextAvailableHotKey(allTaken)).toThrow();
});

test("createAddHotKeyUpdater adds next available hotkey and persists", () => {
  const updates: Record<string, string>[] = [];
  const updater = createAddHotKeyUpdater({
    randomWorkflowUid: "uid-2",
    setHotKeys: (keys) => updates.push(keys),
  });

  const result = updater({ "control+o": "uid-1" });

  expect(result).toEqual({
    "control+o": "uid-1",
    "control+p": "uid-2",
  });
  expect(updates).toEqual([result]);
});

test("createAddHotKeyUpdater keeps state unchanged when combos exhausted", () => {
  const updates: Record<string, string>[] = [];
  const updater = createAddHotKeyUpdater({
    randomWorkflowUid: "uid-next",
    setHotKeys: (keys) => updates.push(keys),
  });
  const allTaken: Record<string, string> = {};
  for (const mod of ["control", "alt", "shift", "meta"]) {
    for (const key of "opklijuyhgfdsawertqzxcvbnm1234567890".split("")) {
      allTaken[`${mod}+${key}`] = `uid-${mod}-${key}`;
    }
  }

  const result = updater(allTaken);

  expect(result).toBe(allTaken);
  expect(updates).toEqual([]);
});
