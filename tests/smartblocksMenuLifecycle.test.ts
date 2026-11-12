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
  initialCaret = initialText.length,
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
  const executions: {
    srcUid: string;
    target: { originalText: string; start: number; end: number };
  }[] = [];
  const savedPins: string[][] = [];
  // Use the real menu, editor events and React lifecycle without Roam services.
  const stubs: Record<string, unknown> = {
    "@blueprintjs/core": {
      Button: ({
        className,
        text,
        onClick,
        disabled,
        "aria-expanded": expanded,
        "aria-pressed": pressed,
        "aria-selected": selected,
      }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        text: React.ReactNode;
      }) =>
        React.createElement(
          "button",
          {
            className,
            onClick,
            disabled,
            "aria-expanded": expanded,
            "aria-pressed": pressed,
            "aria-selected": selected,
          },
          text,
        ),
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
  editor.setSelectionRange(initialCaret, initialCaret);
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
      extensionAPI: {
        settings: {
          get: () => [],
          set: (key: string, pins: string[]) => {
            expect(key).toBe(menuUtils.PINNED_WORKFLOWS_SETTING);
            savedPins.push(pins);
          },
        },
      } as never,
      onClose: () => {},
    }),
  );
  return {
    editor,
    wrapper,
    document: window.document,
    executions,
    savedPins,
    save: (text: string): void => {
      savedText = text;
    },
    type: (
      target: HTMLTextAreaElement,
      text: string,
      caret = text.length,
    ): void =>
      act(() => {
        target.value = text;
        target.setSelectionRange(caret, caret);
        target.dispatchEvent(new window.Event("input", { bubbles: true }));
      }),
    press: (
      target: HTMLTextAreaElement,
      key: string,
      modifiers: KeyboardEventInit = {},
    ): void =>
      act(() => {
        target.dispatchEvent(
          new window.KeyboardEvent("keydown", {
            key,
            bubbles: true,
            cancelable: true,
            ...modifiers,
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

test("the footer and keyboard toggle pinning without changing the editor", () => {
  const menu = menuFixture({ initialText: "jj" });
  try {
    const actions = Array.from(menu.document.querySelectorAll("footer button"));
    const [preview, pin] = actions;
    expect(actions.map((button) => button.firstChild?.textContent)).toEqual([
      "Preview",
      "Pin",
      "Source",
      "Run",
    ]);
    expect(preview.getAttribute("aria-expanded")).toBe("false");
    expect(preview.textContent).toBe("Preview→");
    expect(pin.getAttribute("aria-pressed")).toBe("false");

    menu.press(menu.editor, "ArrowDown");
    menu.press(menu.editor, "ArrowRight");
    expect(preview.getAttribute("aria-expanded")).toBe("true");
    expect(preview.textContent).toBe("Preview←");
    const shortcut = { ctrlKey: true, shiftKey: true };
    menu.press(menu.editor, "Enter", shortcut);
    menu.press(menu.editor, "Enter", { ...shortcut, repeat: true });
    expect(menu.savedPins).toEqual([["bbb"]]);
    expect(pin.getAttribute("aria-pressed")).toBe("true");
    expect(
      menu.document.querySelector("ul [aria-selected='true']")?.textContent,
    ).toBe("Alpine");
    expect(
      menu.document.querySelector("ul .roamjs-smartblocks-workflow")?.textContent,
    ).toBe("Alpine");

    menu.press(menu.editor, "Enter", shortcut);
    expect(menu.savedPins).toEqual([["bbb"], []]);
    expect(pin.getAttribute("aria-pressed")).toBe("false");
    act(() => pin.click());
    expect(menu.savedPins).toEqual([["bbb"], [], ["bbb"]]);
    expect(pin.getAttribute("aria-pressed")).toBe("true");
    menu.press(menu.editor, "ArrowLeft");
    expect(preview.getAttribute("aria-expanded")).toBe("false");
    expect(preview.textContent).toBe("Preview→");
    expect(pin.firstChild?.textContent).toBe("Pin");
    expect(menu.editor.value).toBe("jj");
    expect(menu.executions).toEqual([]);
  } finally {
    menu.cleanup();
  }
});

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
  test(`${action} uses the ranked result and replaces only the original trigger and query`, async () => {
    const before = "Keep this ";
    const invocation = "jj  notes  ";
    const after = " and keep this too";
    const end = before.length + invocation.length;
    const text = before + invocation + after;
    const menu = menuFixture({
      initialText: before + "jj" + after,
      initialCaret: before.length + "jj".length,
      workflows: [
        { uid: "meeting", name: "Meeting notes" },
        { uid: "notes", name: "Notes" },
      ],
    });
    try {
      menu.type(menu.editor, text, end);
      menu.save(text);
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
        .poll(() => menu.executions, { timeout: 1000 })
        .toMatchObject([
          {
            srcUid: "notes",
            target: { originalText: text, start: before.length, end },
          },
        ]);
    } finally {
      menu.cleanup();
    }
  });

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
