import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { createTriggerMenuEventBinding } from "../src/utils/dom";

test("rebinds menu listeners after Roam replaces a linked-reference textarea", () => {
  const { window } = new JSDOM(
    '<div class="rm-reference-item"><div><textarea id="editor"></textarea></div></div>'
  );
  try {
    const editor = window.document.querySelector("textarea")!;
    const bindEvents = createTriggerMenuEventBinding(editor);
    const firstInputs: EventTarget[] = [];
    const unbind = bindEvents(
      () => {},
      (event) => firstInputs.push(event.target!)
    );
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(firstInputs).toEqual([editor]);

    const replacement = window.document.createElement("textarea");
    replacement.id = editor.id;
    editor.replaceWith(replacement);
    unbind();

    const queries: string[] = [];
    const keys: string[] = [];
    const unbindReplacement = bindEvents(
      (event) => keys.push(event.key),
      (event) => queries.push((event.target as HTMLTextAreaElement).value)
    );
    replacement.value = "jjplan";
    replacement.dispatchEvent(new window.Event("input", { bubbles: true }));
    replacement.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    expect(firstInputs).toEqual([editor]);
    expect(queries).toEqual(["jjplan"]);
    expect(keys).toEqual(["Enter"]);

    unbindReplacement();
    replacement.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(queries).toEqual(["jjplan"]);
  } finally {
    window.close();
  }
});
