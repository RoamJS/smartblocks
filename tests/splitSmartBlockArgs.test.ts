import { test, expect } from "@playwright/test";
import splitSmartBlockArgs from "../src/utils/splitSmartBlockArgs";

test("splits nested smartblock commands as a single argument", () => {
  expect(
    splitSmartBlockArgs("ANYCOMMAND", "one,<%RANDOMNUMBER:1,10%>,two")
  ).toEqual(["one", "<%RANDOMNUMBER:1,10%>", "two"]);
});

test("preserves commas in daily note page references", () => {
  expect(
    splitSmartBlockArgs(
      "BLOCKMENTIONSDATED",
      "10,DONE,[[January 24th, 2023]],[[January 1st, 2023]]"
    )
  ).toEqual(["10", "DONE", "[[January 24th, 2023]]", "[[January 1st, 2023]]"]);
});

test("coalesces month-day-year date tokens for BLOCKMENTIONSDATED", () => {
  expect(
    splitSmartBlockArgs(
      "BLOCKMENTIONSDATED",
      "10,DONE,February 1, 2023,February 24, 2023,DESC"
    )
  ).toEqual(["10", "DONE", "February 1, 2023", "February 24, 2023", "DESC"]);
});

test("handles unclosed [[ gracefully by treating rest as single arg", () => {
  expect(
    splitSmartBlockArgs("BLOCKMENTIONSDATED", "10,DONE,[[January 24th")
  ).toEqual(["10", "DONE", "[[January 24th"]);
});

test("preserves commas inside nested page references", () => {
  expect(
    splitSmartBlockArgs(
      "BLOCKMENTIONSDATED",
      "10,DONE,[[January 24th, 2023]],today"
    )
  ).toEqual(["10", "DONE", "[[January 24th, 2023]]", "today"]);
});

test("coalesces at most two date tokens for BLOCKMENTIONSDATED", () => {
  expect(
    splitSmartBlockArgs(
      "BLOCKMENTIONSDATED",
      "10,DONE,January 1, 2023,February 1, 2023,March 1, 2023"
    )
  ).toEqual([
    "10",
    "DONE",
    "January 1, 2023",
    "February 1, 2023",
    "March 1",
    " 2023",
  ]);
});

test("does not coalesce date tokens for non-BLOCKMENTIONSDATED commands", () => {
  expect(
    splitSmartBlockArgs("ANYCOMMAND", "January 1, 2023")
  ).toEqual(["January 1", " 2023"]);
});

test("unclosed [[ in non-BLOCKMENTIONSDATED treats remaining as single arg", () => {
  expect(
    splitSmartBlockArgs("ANYCOMMAND", "one,[[unclosed,two,three")
  ).toEqual(["one", "[[unclosed,two,three"]);
});

test("balanced [[ ]] followed by normal args splits correctly", () => {
  expect(
    splitSmartBlockArgs("ANYCOMMAND", "[[page ref]],normal,arg")
  ).toEqual(["[[page ref]]", "normal", "arg"]);
});
