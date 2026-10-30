import { test, expect } from "@playwright/test";
import mockRoamEnvironment from "roamjs-components/testing/mockRoamEnvironment";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import nanoid from "nanoid";

// @ts-ignore
global.window = global.window || {};
// @ts-ignore
global.window.roamAlphaAPI = global.window.roamAlphaAPI || {
  graph: { name: "test" },
};
// @ts-ignore
global.localStorage = global.localStorage || {
  getItem: () => "",
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { COMMANDS, resetContext } = require("../src/utils/core");

const moveBlockCommand = COMMANDS.find((c) => c.text === "MOVEBLOCK")?.handler;

test.beforeAll(() => {
  mockRoamEnvironment();
});

test.beforeEach(() => {
  resetContext();
});

test("MOVEBLOCK returns API-not-available message when moveBlock is missing", async () => {
  const command = moveBlockCommand;
  expect(command).toBeDefined();

  const pageUid = await createPage({ title: `page-${nanoid()}` });
  const sourceUid = await createBlock({ parentUid: pageUid, node: { text: "s" } });
  const targetUid = await createBlock({ parentUid: pageUid, node: { text: "t" } });

  const originalMoveBlock = (window.roamAlphaAPI as any).moveBlock;
  (window.roamAlphaAPI as any).moveBlock = undefined;

  try {
    const result = await command!(sourceUid, targetUid);
    expect(result).toBe("--> MOVEBLOCK failed: moveBlock API not available <--");
  } finally {
    (window.roamAlphaAPI as any).moveBlock = originalMoveBlock;
  }
});

test("MOVEBLOCK reports source/target validation failures", async () => {
  const command = moveBlockCommand;
  expect(command).toBeDefined();

  const noSourceResult = await command!();
  expect(noSourceResult).toBe(
    "--> MOVEBLOCK failed: source block was not found <--"
  );

  const pageUid = await createPage({ title: `page-${nanoid()}` });
  const sourceUid = await createBlock({
    parentUid: pageUid,
    node: { text: "source" },
  });
  const selfParentResult = await command!(sourceUid, sourceUid);
  expect(selfParentResult).toBe(
    "--> MOVEBLOCK failed: source block cannot be its own parent <--"
  );
});

test("MOVEBLOCK returns moved block ref and calls moveBlock with expected args", async () => {
  const command = moveBlockCommand;
  expect(command).toBeDefined();

  const pageUid = await createPage({ title: `page-${nanoid()}` });
  const sourceParentUid = await createBlock({
    parentUid: pageUid,
    node: { text: "source-parent" },
  });
  const sourceUid = await createBlock({
    parentUid: sourceParentUid,
    node: { text: "source" },
  });
  const targetParentUid = await createBlock({
    parentUid: pageUid,
    node: { text: "target-parent" },
  });
  await createBlock({
    parentUid: targetParentUid,
    node: { text: "existing-child" },
  });

  const originalMoveBlock = (window.roamAlphaAPI as any).moveBlock;
  let moveBlockArgs: unknown;
  (window.roamAlphaAPI as any).moveBlock = async (args: unknown) => {
    moveBlockArgs = args;
  };

  try {
    const result = await command!(sourceUid, targetParentUid, "last");
    expect(result).toBe(`((${sourceUid}))`);
    expect(moveBlockArgs).toEqual({
      location: { "parent-uid": targetParentUid, order: 1 },
      block: { uid: sourceUid },
    });
  } finally {
    (window.roamAlphaAPI as any).moveBlock = originalMoveBlock;
  }
});
