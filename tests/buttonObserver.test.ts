import { test, expect } from "@playwright/test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { render } from "react-dom";
import { readFileSync } from "fs";
import observeSmartBlockButtons from "../src/utils/observeSmartBlockButtons";
import parseSmartBlockButton from "../src/utils/parseSmartBlockButton";

test("binds duplicate captions by rendered position, including literals and generic macros", async () => {
  const dom = new JSDOM("<div id='app'></div>");
  Object.assign(global, {
    window: dom.window,
    document: dom.window.document,
    CustomEvent: dom.window.CustomEvent,
    MutationObserver: dom.window.MutationObserver,
  });
  const app = document.getElementById("app")!;
  const first = "{{b:SmartBlock:UserDNPToday:RemoveButton=false,Icon=archive}}";
  const second = "{{b:SmartBlock:UserDNPDateSelect:RemoveButton=false}}";
  let text = first + " " + second;
  const calls: string[] = [],
    targets: string[] = [];
  let uid = "same-uid";
  const seen: HTMLElement[] = [];
  let nativeClicks = 0;
  const cleanup = new Function(
    ...["el", "iconElement", "clickListener"],
    readFileSync("src/index.ts", "utf8").match(
      /el.insertBefore\(iconElement, el.firstChild\);\s*return \(\) => \{([\s\S]*?)\};/
    )![1]
  );
  const buttonProps = {
    className: "bp3-button bp3-small dont-focus-block",
    onClick: () => nativeClicks++,
  };
  const button = () => {
    const wrapper = document.createElement("span");
    render(createElement("button", buttonProps, "b"), wrapper);
    return wrapper;
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const [main, other, ref] = ["roam-block", "roam-block", "rm-block-ref"].map(
    (className) => {
      const el = document.createElement("div");
      el.className = className;
      el.append(button(), button());
      app.append(el);
      return el;
    }
  );
  const observer = observeSmartBlockButtons({
    getUid: () => uid,
    getText: () => text,
    register: ({ el, text, parentUid, occurrenceIndex }) => {
      const parsed = parseSmartBlockButton("b", text, occurrenceIndex);
      if (!parsed) return () => {};
      seen.push(el);
      const click = () => {
        calls.push(parsed.workflowName);
        targets.push(parentUid);
      };
      el.addEventListener("click", click);
      const icon = document.createElement("span");
      el.prepend(icon);
      return () => cleanup(el, icon, click);
    },
  });
  const expectClicks = (el: Element, expected: readonly string[]) => {
    calls.length = 0;
    el.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
      ((b.firstElementChild as HTMLElement) || b).click()
    );
    expect(calls).toEqual(expected);
  };
  for (const el of [main, other, ref])
    expectClicks(el, ["UserDNPToday", "UserDNPDateSelect"]);

  // Reverse mutation order must not become registration order.
  main.replaceChildren();
  const later = button();
  main.append(later);
  main.prepend(button());
  await flush();
  expectClicks(main, ["UserDNPToday", "UserDNPDateSelect"]);
  expectClicks(other, ["UserDNPToday", "UserDNPDateSelect"]);

  // Replacing/removing/reinserting one sibling must not leave stale handlers.
  const old = main.querySelector("button")!;
  main.firstChild!.replaceWith(button());
  await flush();
  calls.length = 0;
  old.click();
  expect(calls).toEqual([]);
  expectClicks(main, ["UserDNPToday", "UserDNPDateSelect"]);
  main.lastChild!.remove();
  await flush();
  expectClicks(main, []);
  main.append(button());
  await flush();
  expectClicks(main, ["UserDNPToday", "UserDNPDateSelect"]);

  // Source-backed fixtures: Roam renders code literally, and unwraps [[captions]].
  for (const [prefix, generic] of [
    ["`{{b}}` ", false],
    ["`{{b:SmartBlock:Hidden}}` ", false],
    ["{{[[b]]}} ", true],
    ["{{ b }} ", true],
    ["```\n{{b}}\n``` ", false],
  ] as const) {
    text = prefix + first + " " + second;
    main.replaceChildren(...(generic ? [button()] : []), button(), button());
    if (!generic) {
      const code = document.createElement("code");
      code.textContent = prefix;
      main.prepend(code);
    }
    await flush();
    expectClicks(main, ["UserDNPToday", "UserDNPDateSelect"]);
    if (generic)
      expect(
        main.querySelector("button")!.dataset.roamjsSmartblockButton
      ).toBeUndefined();
  }

  // Nested references own their buttons even when the UID is the same.
  text = first + " " + second;
  main.replaceChildren(button(), ref, button());
  await flush();
  expectClicks(ref, ["UserDNPToday", "UserDNPDateSelect"]);
  const own = Array.from(main.querySelectorAll("button")).filter(
    (b) => !ref.contains(b)
  );
  calls.length = 0;
  own.forEach((b) => b.click());
  expect(calls).toEqual(["UserDNPToday", "UserDNPDateSelect"]);

  // React can preserve identical DOM when only the underlying source changes.
  nativeClicks = 0;
  for (const [source, expected] of [
    [second + " " + first, ["UserDNPDateSelect", "UserDNPToday"]],
    ["{{b}} " + first, [null, "UserDNPToday"]],
    [first + " {{b}}", ["UserDNPToday", null]],
    [first, [null, null]],
  ] as const) {
    const icon = other.querySelector("button")!.firstElementChild;
    text = source;
    Array.from(other.children).forEach((el, i) =>
      expectClicks(el, expected[i] ? [expected[i]!] : [])
    );
    await Promise.resolve();
    if (icon) expect(icon.isConnected).toBe(true);
    await flush();
    if (icon) expect(icon.isConnected).toBe(false);
  }
  expect(nativeClicks).toBe(8);
  text = first + " " + second;
  uid = "new-uid";
  targets.length = 0;
  own.forEach((b) => b.click());
  expect(targets).toEqual([uid, uid]);

  observer.disconnect();
  observer.unload();
  calls.length = 0;
  seen.forEach((b) => b.click());
  expect(calls).toEqual([]);
  await flush();
  expect(app.querySelector("button span")).toBeNull();
  dom.window.close();
});
