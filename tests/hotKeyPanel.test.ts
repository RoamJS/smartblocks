import { test, expect } from "@playwright/test";
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
