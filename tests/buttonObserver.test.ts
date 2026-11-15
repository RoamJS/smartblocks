import { test, expect } from "@playwright/test";
import { JSDOM } from "jsdom";
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
  const button = () => {
    const wrapper = document.createElement("span");
    wrapper.innerHTML =
      '<button class="bp3-button bp3-small dont-focus-block">b</button>';
    return wrapper;
  };
  const scope = (className = "roam-block") => {
    const el = document.createElement("div");
    el.className = className;
    app.append(el);
    return el;
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const main = scope(),
    other = scope(),
    ref = scope("rm-block-ref");
  main.append(button(), button());
  other.append(button(), button());
  ref.append(button(), button());
  const observer = observeSmartBlockButtons({
    getUid: () => uid,
    getText: () => text,
    register: ({ el, text, parentUid, occurrenceIndex }) => {
      const parsed = parseSmartBlockButton(
        el.textContent || "",
        text,
        occurrenceIndex
      );
      if (!parsed) return () => {};
      seen.push(el);
      const click = () => {
        calls.push(parsed.workflowName);
        targets.push(parentUid);
      };
      el.addEventListener("click", click);
      const icon = document.createElement("span");
      el.prepend(icon);
      return () => {
        el.removeEventListener("click", click);
        icon.remove();
      };
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
        main
          .querySelector("button")!
          .hasAttribute("data-roamjs-smartblock-button")
      ).toBe(false);
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
  let nativeClicks = 0;
  other.addEventListener("click", () => nativeClicks++);
  for (const [source, expected] of [
    [second + " " + first, ["UserDNPDateSelect", "UserDNPToday"]],
    ["{{b}} " + first, [null, "UserDNPToday"]],
    [first + " {{b}}", ["UserDNPToday", null]],
    [first, [null, null]],
  ] as const) {
    text = source;
    Array.from(other.children).forEach((el, i) =>
      expectClicks(el, expected[i] ? [expected[i]!] : [])
    );
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
  dom.window.close();
});
