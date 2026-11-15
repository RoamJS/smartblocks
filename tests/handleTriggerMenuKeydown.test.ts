import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import getTriggerSelection from "../src/utils/getTriggerSelection";
import handleTriggerMenuKeydown from "../src/utils/handleTriggerMenuKeydown";

test("lets Left Arrow through after Ctrl+E moved the caret beyond the query", () => {
  const { window } = new JSDOM(
    '<textarea></textarea><ul data-active-index="0"><li></li></ul>'
  );
  try {
    const editor = window.document.querySelector("textarea")!;
    const menu = window.document.querySelector("ul")!;
    const text = "keep jj existing suffix";
    const queryEnd = "keep jj".length;
    const selection = getTriggerSelection({
      text,
      selectionStart: queryEnd,
      trigger: "jj",
    })!;
    editor.value = text;
    editor.setSelectionRange(queryEnd, queryEnd);
    let selectedWorkflow = false;
    let forwardedLeftArrows = 0;
    window.document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") forwardedLeftArrows++;
    });
    editor.addEventListener("keydown", (event) =>
      handleTriggerMenuKeydown({
        event,
        menu: menu.isConnected ? menu : null,
        editor,
        selection,
        setActiveIndex: () => {},
        onSelect: () => {
          selectedWorkflow = true;
        },
        onClose: () => menu.remove(),
      })
    );
    const press = (key: string, ctrlKey = false) =>
      editor.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key,
          ctrlKey,
          bubbles: true,
          cancelable: true,
        })
      );

    expect(press("ArrowLeft")).toBe(false);
    expect(menu.isConnected).toBe(true);
    expect(press("e", true)).toBe(true);
    // The browser moves the caret after Ctrl+E without an input event.
    editor.setSelectionRange(text.length, text.length);
    expect(press("ArrowLeft")).toBe(true);
    expect(forwardedLeftArrows).toBe(1);
    expect(menu.isConnected).toBe(false);
    expect(press("Enter")).toBe(true);
    expect(selectedWorkflow).toBe(false);
    expect(editor.value).toBe(text);
  } finally {
    window.close();
  }
});
