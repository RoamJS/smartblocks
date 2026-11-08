import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { JSDOM } from "jsdom";
import path from "path";
import React from "react";
import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import ts from "typescript";
import { createTriggerMenuEventBinding } from "../src/utils/dom";
import getTriggerSelection from "../src/utils/getTriggerSelection";
import * as triggerSelection from "../src/utils/getTriggerSelection";
import handleTriggerMenuKeydown from "../src/utils/handleTriggerMenuKeydown";
import * as menuUtils from "../src/utils/smartblocksMenu";

const menuFixture = ({
  initialText = "jjAl",
  workflows = [
    { uid: "aaa", name: "Alpha" },
    { uid: "bbb", name: "Alpine" },
  ],
} = {}) => {
  const { window } = new JSDOM(
    '<div class="rm-reference-item"><div><textarea id="editor"></textarea></div></div>',
  );
  const globals = {
    window,
    document: window.document,
    Element: window.Element,
    MutationObserver: window.MutationObserver,
    ResizeObserver: class {
      observe(): void {}
      disconnect(): void {}
    },
  };
  const original = Object.entries(globals).map(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    return [key, descriptor] as const;
  });
  window.roamAlphaAPI = {
    ui: {
      getFocusedBlock: () => ({ "block-uid": "block", "window-id": "main" }),
    },
  };
  let savedText = "";
  const executions: { srcUid: string; target: { originalText: string } }[] = [];
  // Use the real menu, editor events and React lifecycle without Roam services.
  const stubs: Record<string, unknown> = {
    "@blueprintjs/core": {
      Button: ({
        className,
        text,
        onClick,
      }: {
        className?: string;
        text: React.ReactNode;
        onClick: () => void;
      }) => React.createElement("button", { className, onClick }, text),
      Menu: ({
        ulRef,
        children,
      }: {
        ulRef: React.Ref<HTMLUListElement>;
        children: React.ReactNode;
      }) => React.createElement("ul", { ref: ulRef }, children),
      Popover: ({ content }: { content: React.ReactNode }) => content,
      Position: { BOTTOM_LEFT: "bottom-left" },
    },
    "roamjs-components/queries/getTextByBlockUid": () => savedText,
    "./components/WorkflowPreview": () => null,
    "./utils/dom": {
      getCoords: () => ({ left: 0, top: 0 }),
      createTriggerMenuEventBinding,
    },
    "./utils/getTriggerSelection": triggerSelection,
    "./utils/handleTriggerMenuKeydown": handleTriggerMenuKeydown,
    "./utils/core": {
      getVisibleCustomWorkflows: () => workflows,
      predefinedWorkflows: [],
      PREDEFINED_REGEX: /^predefined/,
      sbBomb: (execution: (typeof executions)[number]) =>
        executions.push(execution),
    },
    "./utils/smartblocksMenu": menuUtils,
  };
  const { outputText } = ts.transpileModule(
    readFileSync(path.resolve(__dirname, "../src/SmartblocksMenu.tsx"), "utf8"),
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    },
  );
  const compiled = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name: string) => stubs[name] ?? require(name),
    compiled,
    compiled.exports,
  );
  const editor = window.document.querySelector("textarea")!;
  const wrapper = editor.parentElement!;
  editor.value = initialText;
  editor.setSelectionRange(initialText.length, initialText.length);
  const initialSelection = getTriggerSelection({
    text: editor.value,
    selectionStart: editor.selectionStart,
    trigger: "jj",
  });
  const { render } =
    compiled.exports as typeof import("../src/SmartblocksMenu");
  act(() =>
    render({
      textarea: editor,
      trigger: "jj",
      initialSelection: initialSelection!,
      isCustomOnly: true,
      extensionAPI: { settings: { get: () => [] } } as never,
      onClose: () => {},
    }),
  );
  return {
    editor,
    wrapper,
    document: window.document,
    executions,
    save: (text: string): void => {
      savedText = text;
    },
    type: (target: HTMLTextAreaElement, text: string): void =>
      act(() => {
        target.value = text;
        target.setSelectionRange(text.length, text.length);
        target.dispatchEvent(new window.Event("input", { bubbles: true }));
      }),
    press: (target: HTMLTextAreaElement, key: string): void =>
      act(() => {
        target.dispatchEvent(
          new window.KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
          }),
        );
      }),
    cleanup: (): void => {
      if (wrapper.firstElementChild?.tagName === "SPAN")
        ReactDOM.unmountComponentAtNode(wrapper.firstElementChild);
      window.close();
      for (const [key, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
};

test("keeps keyboard selection working after a linked-reference editor is replaced", async () => {
  const menu = menuFixture();
  try {
    const replacement = menu.document.createElement("textarea");
    replacement.id = menu.editor.id;
    menu.editor.replaceWith(replacement);
    menu.type(replacement, "jjAlp");
    menu.save(replacement.value);
    menu.press(replacement, "ArrowDown");
    menu.press(replacement, "Enter");
    await expect
      .poll(() => menu.executions.map(({ srcUid }) => srcUid))
      .toEqual(["bbb"]);
  } finally {
    menu.cleanup();
  }
});

for (const action of ["Enter", "click"] as const) {
  test(`${action} runs the first named workflow when unnamed drafts exist`, async () => {
    const menu = menuFixture({
      initialText: "jj",
      workflows: [
        { uid: "unnamed", name: "" },
        { uid: "spaces", name: "   " },
        { uid: "aaa", name: "Alpha" },
      ],
    });
    try {
      menu.save(menu.editor.value);
      if (action === "Enter") {
        menu.press(menu.editor, "Enter");
      } else {
        menu.editor.blur = () => menu.editor.remove();
        const firstRow = menu.document.querySelector<HTMLButtonElement>(
          ".roamjs-smartblocks-workflow",
        )!;
        act(() => firstRow.click());
      }
      await expect
        .poll(() => menu.executions.map(({ srcUid }) => srcUid), {
          timeout: 1000,
        })
        .toEqual(["aaa"]);
    } finally {
      menu.cleanup();
    }
  });
}

test("a changed query cancels the pending save and the next Enter runs once", async () => {
  const menu = menuFixture();
  try {
    menu.press(menu.editor, "Enter");
    menu.type(menu.editor, "jjAlp");
    menu.save(menu.editor.value);
    menu.press(menu.editor, "Enter");
    menu.press(menu.editor, "Enter");
    await expect
      .poll(() => menu.executions.map(({ target }) => target.originalText))
      .toEqual(["jjAlp"]);
    expect(menu.document.querySelector("ul")).toBeNull();
  } finally {
    menu.cleanup();
  }
});

test("a pointer run survives Roam closing the editor before its save", async () => {
  const menu = menuFixture();
  try {
    let blurRequested = false;
    menu.editor.blur = () => {
      blurRequested = true;
    };
    menu.document.addEventListener("click", () => {
      if (blurRequested) menu.editor.remove();
    });
    const run = menu.document.querySelector<HTMLButtonElement>("ul button")!;
    act(() => run.click());
    await Promise.resolve();
    expect(menu.editor.isConnected).toBe(false);
    expect(menu.document.querySelector("ul")).not.toBeNull();
    expect(menu.executions).toHaveLength(0);
    menu.save(menu.editor.value);
    await expect
      .poll(() => menu.executions.map(({ target }) => target.originalText))
      .toEqual(["jjAl"]);
  } finally {
    menu.cleanup();
  }
});
