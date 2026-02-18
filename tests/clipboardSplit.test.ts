import { expect, test } from "@playwright/test";

if (!globalThis.window) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
}
const windowObject = globalThis.window as { roamAlphaAPI?: { graph?: { name: string } } };
windowObject.roamAlphaAPI = windowObject.roamAlphaAPI || { graph: { name: "test-graph" } };
windowObject.roamAlphaAPI.graph = windowObject.roamAlphaAPI.graph || {
  name: "test-graph",
};

if (!globalThis.localStorage) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
  });
}

const { COMMANDS } = require("../src/utils/core") as typeof import("../src/utils/core");
const clipboardCommand = COMMANDS.find((c) => c.text === "CLIPBOARDPASTETEXT");
if (!clipboardCommand) {
  throw new Error("CLIPBOARDPASTETEXT command is missing");
}

const setClipboardText = (text: string) => {
  if (!globalThis.navigator) {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });
  }
  Object.defineProperty(globalThis.navigator as object, "clipboard", {
    configurable: true,
    value: {
      readText: async () => text,
    },
  });
};

const runClipboardCommand = async (text: string, ...args: string[]) => {
  setClipboardText(text);
  return clipboardCommand.handler(...args);
};

const normalize = (value: unknown) => JSON.parse(JSON.stringify(value));

test("CLIPBOARDPASTETEXT split preserves hierarchy with mixed tab and space indentation", async () => {
  const result = normalize(
    await runClipboardCommand(
      [
        "Root",
        "\tTab child",
        "\t\tTab grandchild",
        "  Space child",
        "    Space grandchild",
      ].join("\n"),
      "split"
    )
  );

  expect(result).toEqual([
    {
      text: "Root",
      children: [
        { text: "Tab child", children: [{ text: "Tab grandchild" }] },
        { text: "Space child", children: [{ text: "Space grandchild" }] },
      ],
    },
  ]);
});

test("CLIPBOARDPASTETEXT split resets hierarchy after blank lines", async () => {
  const result = normalize(
    await runClipboardCommand(
      ["Parent", "  Child", "", "After blank", "  New child"].join("\n"),
      "split"
    )
  );

  expect(result).toEqual([
    { text: "Parent", children: [{ text: "Child" }] },
    { text: "" },
    { text: "After blank", children: [{ text: "New child" }] },
  ]);
});

test("CLIPBOARDPASTETEXT split applies nohyphens and noextraspaces per line", async () => {
  const result = normalize(
    await runClipboardCommand(
      ["-  Parent   item", "  *   Child    item"].join("\n"),
      "split",
      "nohyphens",
      "noextraspaces"
    )
  );

  expect(result).toEqual([
    {
      text: "Parent item",
      children: [{ text: "Child item" }],
    },
  ]);
});

test("CLIPBOARDPASTETEXT non-split behavior remains unchanged", async () => {
  const result = await runClipboardCommand(
    "- Foo   bar",
    "nohyphens",
    "noextraspaces"
  );

  expect(result).toEqual(["Foo bar"]);
});
