import createObserver from "roamjs-components/dom/createObserver";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import parseSmartBlockButton, {
  getButtonMatches,
} from "./parseSmartBlockButton";

const selector = "button.bp3-button.bp3-small.dont-focus-block";
const scopeOf = (el: Element) =>
  el.closest(
    ".rm-block-ref, .roamjs-block-view, .rm-alias-tooltip__content, .kanban-title, .roam-block"
  );

const observeSmartBlockButtons = ({
  register,
  getUid = getBlockUidFromTarget,
  getText = getTextByBlockUid,
}: {
  register: (args: {
    el: HTMLElement;
    text: string;
    parentUid: string;
    occurrenceIndex: number;
  }) => () => void;
  getUid?: typeof getBlockUidFromTarget;
  getText?: typeof getTextByBlockUid;
}) => {
  const states = new Map<
    Element,
    {
      text: string;
      parentUid: string;
      buttons: HTMLElement[];
      labels: string[];
      cleanups: (() => void)[];
    }
  >();
  const clear = (scope: Element) => {
    states.get(scope)?.cleanups.forEach((cleanup) => cleanup());
    states.delete(scope);
  };
  const refresh = (scope: Element) => {
    const buttons = Array.from(
      scope.querySelectorAll<HTMLElement>(selector)
    ).filter((b) => scopeOf(b) === scope);
    const parentUid = buttons[0] && getUid(buttons[0]);
    const text = parentUid ? getText(parentUid) : "";
    const labels = buttons.map((b) => (b.textContent || "").trim());
    const old = states.get(scope);
    if (
      old?.text === text &&
      old.parentUid === parentUid &&
      old.buttons.length === buttons.length &&
      buttons.every(
        (b, i) => b === old.buttons[i] && labels[i] === old.labels[i]
      )
    )
      return;
    clear(scope);
    if (!parentUid || !buttons.length) return;
    const cleanups: (() => void)[] = [];
    states.set(scope, { text, parentUid, buttons, labels, cleanups });
    for (const label of new Set(labels)) {
      const peers = buttons.filter((_, i) => labels[i] === label);
      const matches = getButtonMatches(label, text);
      // A partial or unfamiliar rendering must never run the wrong workflow.
      if (matches.length !== peers.length) continue;
      peers.forEach((el, occurrenceIndex) => {
        if (!parseSmartBlockButton(label, text, occurrenceIndex)) return;
        const unload = register({ el, text, parentUid, occurrenceIndex });
        el.setAttribute("data-roamjs-smartblock-button", "true");
        cleanups.push(() => {
          unload();
          el.removeAttribute("data-roamjs-smartblock-button");
        });
      });
    }
  };
  const collect = (node: Node, scopes: Set<Element>) => {
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const scope = scopeOf(el);
    if (scope) scopes.add(scope);
    el.querySelectorAll(selector).forEach((b) => {
      const owner = scopeOf(b);
      if (owner) scopes.add(owner);
    });
  };
  // Reconcile complete mutation batches, not createHTMLObserver callback order.
  const observer = createObserver((mutations) => {
    const scopes = new Set<Element>();
    mutations.forEach((m) => {
      collect(m.target, scopes);
      m.addedNodes.forEach((n) => collect(n, scopes));
    });
    states.forEach((_, scope) => {
      if (!scope.isConnected) clear(scope);
    });
    scopes.forEach((scope) => {
      if (scope.isConnected) refresh(scope);
    });
  });
  // Source-only edits may produce no mutations. Refresh before button listeners run.
  const onClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest?.(selector);
    const scope = button && scopeOf(button);
    if (scope) refresh(scope);
  };
  document.addEventListener("click", onClick, true);
  const scopes = new Set<Element>();
  collect(document.body, scopes);
  scopes.forEach(refresh);
  return Object.assign(observer, {
    unload: () => {
      document.removeEventListener("click", onClick, true);
      states.forEach((_, scope) => clear(scope));
    },
  });
};
export default observeSmartBlockButtons;
