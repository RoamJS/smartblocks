import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { readFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import ts from "typescript";
import mockRoamEnvironment from "roamjs-components/testing/mockRoamEnvironment";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import updateBlock from "roamjs-components/writes/updateBlock";
let core: typeof import("../src/utils/core");
const templates: Record<
  string,
  { text: string; parentView: ":bullet" | ":numbered"; blockViewType: "outline" }
> = {};
let parentUid = "";

test.beforeAll(() => {
  mockRoamEnvironment();
  const { roamAlphaAPI } = window;
  const jsdom = new JSDOM("", { url: "https://example.com" });
  // @ts-ignore
  global.window = jsdom.window;
  global.document = jsdom.window.document;
  window.roamAlphaAPI = roamAlphaAPI;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: jsdom.window.localStorage,
  });
  const corePath = path.resolve(__dirname, "../src/utils/core.ts");
  const compiled = { exports: {} };
  const localRequire = createRequire(corePath);
  const stubs: Record<string, unknown> = {
    "roamjs-components/queries/getOrderByBlockUid": () => 0,
    "roamjs-components/queries/getParentUidByBlockUid": () => parentUid,
    "roamjs-components/queries/getFullTreeByParentUid": (uid: string) => ({
      children: [
        {
          text: templates[uid].text,
          // The real reader derives a node's view from its nearest parent.
          viewType: templates[uid].parentView.slice(1),
          blockViewType: templates[uid].blockViewType,
        },
      ],
    }),
    "../Prompt": {},
    "./getDailyConfig": {},
    "./scheduleNextDailyRun": {},
    "./zodTypes": {},
  };
  const { outputText } = ts.transpileModule(readFileSync(corePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  new Function("require", "module", "exports", outputText)(
    (name: string) => stubs[name] ?? localRequire(name),
    compiled,
    compiled.exports,
  );
  core = compiled.exports as typeof import("../src/utils/core");
});

test("sets and toggles views on existing blocks", async () => {
  const parentUid = await createPage({ title: "View type test" });
  const uid = await createBlock({ parentUid, node: { text: "Keep me" } });
  const pull = () =>
    window.roamAlphaAPI.pull(
      "[:block/string :children/view-type :block/view-type]",
      [":block/uid", uid],
    );
  const view = core.handlerByCommand.VIEWTYPE.handler;
  const blockView = core.handlerByCommand.BLOCKVIEWTYPE.handler;

  expect(await view(uid, "toggle")).toBe("");
  expect(pull()[":children/view-type"]).toBe(":numbered");
  expect(await view(uid, "toggle")).toBe("");
  expect(pull()[":children/view-type"]).toBe(":bullet");
  expect(await view(uid, " Numbered ")).toBe("");
  expect(pull()[":children/view-type"]).toBe(":numbered");
  expect(await blockView(`((${uid}))`, " Tabs ")).toBe("");
  expect(pull()[":block/view-type"]).toBe(":tabs");
  core.smartBlocksContext.variables.v = `((${uid}))`;
  expect(await view("v", "document")).toBe("");
  expect(pull()[":children/view-type"]).toBe(":document");
  const before = { ...pull() };
  expect(await view(uid, " Invalid ")).toBe("Invalid view type: Invalid");
  expect(await blockView(uid, " Invalid ")).toBe(
    "Invalid block view type: Invalid",
  );
  expect(await view("missing", "bullet")).toBe("Could not find block: missing");
  expect(await blockView("missing", "tabs")).toBe(
    "Could not find block: missing",
  );
  expect(pull()).toEqual(before);
  expect(pull()[":block/string"]).toBe("Keep me");
});

test("workflow toggles the trigger without overwriting its views", async () => {
  parentUid = await createPage({ title: "Trigger view test" });
  const uid = await createBlock({ parentUid, node: { text: "Trigger" } });
  await createBlock({ parentUid: uid, node: { text: "Child" } });
  const siblingUid = await createBlock({
    parentUid,
    node: { text: "Sibling" },
  });
  const pull = (blockUid: string) =>
    window.roamAlphaAPI.pull(
      "[:block/string :children/view-type :block/view-type]",
      [":block/uid", blockUid],
    );
  await updateBlock({ uid, viewType: "numbered", blockViewType: "tabs" });
  const siblingBefore = { ...pull(siblingUid) };
  templates.toggle = {
    text: "<%VIEWTYPE:<%TRIGGERREF%>,toggle%>",
    parentView: ":numbered",
    blockViewType: "outline",
  };
  const run = (srcUid: string) =>
    core.sbBomb({ srcUid, target: { uid }, fromDaily: true });
  await run("toggle");
  expect(pull(uid)[":children/view-type"]).toBe(":bullet");
  expect(pull(uid)[":block/view-type"]).toBe(":outline");
  await run("toggle");
  expect(pull(uid)[":children/view-type"]).toBe(":numbered");
  templates.double = {
    ...templates.toggle,
    text: templates.toggle.text + templates.toggle.text,
  };
  await run("double");
  expect(pull(uid)[":children/view-type"]).toBe(":numbered");
  expect(pull(uid)[":block/string"]).toBe("Trigger");
  expect(pull(siblingUid)).toEqual(siblingBefore);
  await updateBlock({ uid, blockViewType: "side" });
  templates.blockView = {
    ...templates.toggle,
    text: "<%BLOCKVIEWTYPE:<%TRIGGERREF%>,tabs%>",
  };
  await run("blockView");
  expect(pull(uid)[":block/view-type"]).toBe(":tabs");
  await updateBlock({ uid, viewType: "numbered", blockViewType: "tabs" });
  templates.plain = {
    text: "Plain",
    parentView: ":bullet",
    blockViewType: "outline",
  };
  await run("plain");
  expect(pull(uid)[":children/view-type"]).toBe(":bullet");
  expect(pull(uid)[":block/view-type"]).toBe(":outline");
});

test("inline nested workflow preserves its view write", async () => {
  parentUid = await createPage({ title: "Nested view test" });
  const uid = await createBlock({ parentUid, node: { text: "Trigger" } });
  await updateBlock({ uid, viewType: "numbered" });
  templates.outer = {
    text: "<%SMARTBLOCK:Nested%>",
    parentView: ":numbered",
    blockViewType: "outline",
  };
  templates.nested = {
    text: "<%VIEWTYPE:<%TRIGGERREF%>,toggle%>",
    parentView: ":numbered",
    blockViewType: "outline",
  };
  const fast = window.roamAlphaAPI.data.fast;
  const originalQuery = fast.q;
  fast.q = (() => [
    [{ ":block/uid": "nested", ":block/string": "Nested #SmartBlock" }],
  ]) as typeof fast.q;
  try {
    await core.sbBomb({ srcUid: "outer", target: { uid }, fromDaily: true });
    expect(
      window.roamAlphaAPI.pull("[:children/view-type]", [":block/uid", uid])[
        ":children/view-type"
      ],
    ).toBe(":bullet");
  } finally {
    fast.q = originalQuery;
  }
});
