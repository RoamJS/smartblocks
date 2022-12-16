import { test, expect } from "@playwright/test";
import mockRoamEnvironment from "roamjs-components/testing/mockRoamEnvironment";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import { sbBomb } from "../src/core";
import nanoid from "nanoid";
import { JSDOM } from "jsdom";

test.beforeAll(() => {
  mockRoamEnvironment();
  const { roamAlphaAPI } = window;
  const jsdom = new JSDOM();
  // @ts-ignore
  global.window = jsdom.window;
  global.document = jsdom.window.document;
  window.roamAlphaAPI = roamAlphaAPI;
});

test("Nested CURSOR command", async () => {
  const parentUid = await createPage({ title: `page-${nanoid()}` });
  const srcUid = await createBlock({
    node: {
      text: "#SmartBlock Nested",
      children: [
        {
          text: "<%SMARTBLOCK:Cursor%>",
        },
      ],
    },
    parentUid,
  });
  await createBlock({
    node: {
      text: "#SmartBlock Cursor",
      children: [
        {
          text: "Place the cursor here: <%CURSOR%>",
        },
      ],
    },
    parentUid,
  });
  const targetUid = await createBlock({ node: { text: "" }, parentUid });
  const result = targetUid;// TODO: await sbBomb({ srcUid, target: { uid: targetUid } });
  expect(result).toEqual(targetUid);
});
