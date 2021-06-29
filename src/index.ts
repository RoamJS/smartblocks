import {
  toConfig,
  runExtension,
  getTreeByPageName,
  getBlockUidsAndTextsReferencingPage,
  addStyle,
} from "roam-client";
import {
  createConfigObserver,
  getSettingValueFromTree,
} from "roamjs-components";
import { render } from "./SmartblocksMenu";
import lego from './img/lego3blocks.png';

addStyle(`.rm-page-ref--tag[data-tag="42SmartBlock"]:before, .rm-page-ref--tag[data-tag="SmartBlock"]:before {
  display:inline-block;
  height:14px;
  width:24px;
  content: "";
  background:url(${lego}) no-repeat 0 0;
  background-size: auto 14px;
}`);

const getLegacy42Setting = (name: string) => {
  const settings = Object.fromEntries(
    getBlockUidsAndTextsReferencingPage("42Setting").map(({ text, uid }) => {
      const [_, name, value] = text.trim().split(/\s/);
      return [name, { value, uid }];
    })
  );
  return (settings[name]?.value || "").replace(/"/g, "").trim();
};

const ID = "smartblocks";
const CONFIG = toConfig(ID);
runExtension("smartblocks", () => {
  createConfigObserver({
    title: CONFIG,
    config: {
      tabs: [
        {
          id: "home",
          fields: [
            {
              type: "text",
              title: "trigger",
              description:
                "The key combination to used to pull up the smart blocks menu",
              defaultValue: "xx",
            },
          ],
        },
      ],
    },
  });

  const tree = getTreeByPageName(CONFIG);
  const trigger =
    getLegacy42Setting("SmartBlockTrigger") ||
    getSettingValueFromTree({
      tree,
      key: "trigger",
      defaultValue: "xx",
    })
      .replace(/"/g, "")
      .trim();
  const triggerRegex = new RegExp(`${trigger}$`);

  document.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "TEXTAREA" &&
      target.classList.contains("rm-block-input")
    ) {
      const textarea = target as HTMLTextAreaElement;
      const valueToCursor = textarea.value.substring(
        0,
        textarea.selectionStart
      );
      if (triggerRegex.test(valueToCursor)) {
        render({ textarea, triggerLength: triggerRegex.source.length - 1 });
      }
    }
  });
});
