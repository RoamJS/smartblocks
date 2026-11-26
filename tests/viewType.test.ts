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
const templates: Record<string, string> = {};
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
    "roamjs-components/queries/getParentUidByBlockUid": (uid: string) =>
      uid === parentUid ? "" : parentUid,
    // The real reader gives each node its nearest parent's children view and
    // its own block view, else outline. Templates sit under a numbered parent.
    "roamjs-components/queries/getFullTreeByParentUid": (uid: string) => ({
      children: [
        {
          text: templates[uid],
          viewType: "numbered",
          blockViewType: "outline",
        },
      ],
    }),
    "../Prompt": {},
    "./getDailyConfig": () => ({}),
    "./scheduleNextDailyRun": () => {},
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

const pull = (uid: string) =>
  window.roamAlphaAPI.pull(
    "[:block/string :children/view-type :block/view-type]",
    [":block/uid", uid],
  );
const trigger = async (title: string) => {
  parentUid = await createPage({ title });
  return createBlock({ parentUid, node: { text: "Trigger" } });
};
const run = (srcUid: string, uid: string) =>
  core.sbBomb({ srcUid, target: { uid }, fromDaily: true });

test("sets and toggles views on existing blocks", async () => {
  const pageUid = await createPage({ title: "View type test" });
  parentUid = pageUid;
  const uid = await createBlock({ parentUid: pageUid, node: { text: "Keep" } });
  const view = core.handlerByCommand.VIEWTYPE.handler;
  const blockView = core.handlerByCommand.BLOCKVIEWTYPE.handler;

  expect(await view(uid, " Numbered ")).toBe("");
  expect(pull(uid)[":children/view-type"]).toBe(":numbered");
  expect(await blockView(`((${uid}))`, " Tabs ")).toBe("");
  expect(pull(uid)[":block/view-type"]).toBe(":tabs");
  Object.assign(core.smartBlocksContext.variables, {
    v: `((${uid}))`,
    t: "document",
    b: "side",
  });
  expect(await view("v", "t")).toBe("");
  expect(await blockView("v", "b")).toBe("");
  expect(pull(uid)[":children/view-type"]).toBe(":document");
  expect(pull(uid)[":block/view-type"]).toBe(":side");
  expect(await view(uid, "toggle")).toBe("");
  expect(pull(uid)[":children/view-type"]).toBe(":numbered");
  const before = { ...pull(uid) };
  expect(await view(uid, " Invalid ")).toBe("Invalid view type: Invalid");
  expect(await blockView(uid, " Invalid ")).toBe(
    "Invalid block view type: Invalid",
  );
  expect(await view("missing", "bullet")).toBe("Could not find block: missing");
  expect(await blockView("missing", "tabs")).toBe(
    "Could not find block: missing",
  );
  expect(pull(uid)).toEqual(before);
  expect(pull(uid)[":block/string"]).toBe("Keep");

  await updateBlock({ uid: pageUid, viewType: "numbered" });
  expect(await view(uid, "toggle")).toBe("");
  expect(pull(uid)[":children/view-type"]).toBe(":bullet");
});

test("workflow toggles the trigger without overwriting its views", async () => {
  const uid = await trigger("Trigger view test");
  await updateBlock({ uid, viewType: "numbered", blockViewType: "tabs" });
  templates.toggle = "<%VIEWTYPE:<%TRIGGERREF%>,toggle%>";
  templates.blockView = "<%BLOCKVIEWTYPE:<%TRIGGERREF%>,side%>";
  templates.plain = "Plain";

  await run("toggle", uid);
  expect(pull(uid)[":children/view-type"]).toBe(":bullet");
  expect(pull(uid)[":block/view-type"]).toBe(":outline");
  await run("toggle", uid);
  expect(pull(uid)[":children/view-type"]).toBe(":numbered");
  expect(pull(uid)[":block/string"]).toBe("Trigger");
  await run("blockView", uid);
  expect(pull(uid)[":block/view-type"]).toBe(":side");
  await updateBlock({ uid, viewType: "bullet", blockViewType: "tabs" });
  await run("plain", uid);
  expect(pull(uid)[":children/view-type"]).toBe(":numbered");
  expect(pull(uid)[":block/view-type"]).toBe(":outline");
});

test("nested workflows preserve their view writes to the outer trigger", async () => {
  const uid = await trigger("Nested view test");
  await createPage({ title: "Dest" });
  templates.inline = "<%SET:t,<%TRIGGERREF%>%><%SMARTBLOCK:Nested%>";
  templates.remote = "<%SET:t,<%TRIGGERREF%>%><%SMARTBLOCK:Nested,Dest%>";
  templates.nested = "<%VIEWTYPE:t,toggle%>";
  const fast = window.roamAlphaAPI.data.fast;
  const originalQuery = fast.q;
  fast.q = (() => [
    [{ ":block/uid": "nested", ":block/string": "Nested #SmartBlock" }],
  ]) as typeof fast.q;
  try {
    for (const srcUid of ["inline", "remote"]) {
      await updateBlock({ uid, viewType: "numbered" });
      await run(srcUid, uid);
      expect(pull(uid)[":children/view-type"]).toBe(":bullet");
    }
  } finally {
    fast.q = originalQuery;
  }
});
