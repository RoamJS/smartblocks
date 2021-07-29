import {
  toConfig,
  runExtension,
  getTreeByPageName,
  getBlockUidsAndTextsReferencingPage,
  addStyle,
  toRoamDateUid,
  getChildrenLengthByPageUid,
  createPage,
  toRoamDate,
  createBlock,
  getPageUidByPageTitle,
  getShallowTreeByParentUid,
  createHTMLObserver,
  getBlockUidFromTarget,
  getTextByBlockUid,
  updateBlock,
} from "roam-client";
import {
  createConfigObserver,
  getSettingValueFromTree,
  toFlexRegex,
} from "roamjs-components";
import addDays from "date-fns/addDays";
import addHours from "date-fns/addHours";
import addMinutes from "date-fns/addMinutes";
import startOfDay from "date-fns/startOfDay";
import isBefore from "date-fns/isBefore";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";
import { render } from "./SmartblocksMenu";
import { render as renderStore } from "./SmartblocksStore";
import { render as renderPopover } from "./SmartblockPopover";
import {
  CommandHandler,
  getCustomWorkflows,
  handlerByCommand,
  sbBomb,
} from "./smartblocks";
import TokenPanel from "./TokenPanel";
import lego from "./img/lego3blocks.png";

addStyle(`.roamjs-smartblocks-popover-target {
  display:inline-block;
  height:14px;
  width:17px;
  margin-right:7px;
}

.bp3-portal {
  z-index: 1000;
}

.roamjs-smartblocks-store-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  padding: 4px;
  cursor: pointer;
  font-size: 12px;
}

.roamjs-smartblocks-store-item.roamjs-unavailable {
  opacity: 0.8;
  background-color: #80808080;
  cursor: not-allowed;
}

.roamjs-smartblocks-store-item.roamjs-available:hover {
  box-shadow: 0px 3px 6px #00000040;
  transform: translate(0,-3px);
}

.roamjs-smartblocks-store-label .bp3-popover-wrapper {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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
            {
              title: "custom only",
              type: "flag",
              description:
                "If checked, will exclude all the predefined workflows from Smart Blocks Menu",
            },
          ],
        },
        {
          id: "daily",
          fields: [
            {
              type: "text",
              title: "workflow name",
              description:
                "The workflow name used to automatically trigger on each day's daily note page.",
              defaultValue: "Daily",
            },
            {
              type: "time",
              title: "time",
              description:
                "The time (24hr format) when the daily workflow is triggered each day.",
            },
          ],
          toggleable: true,
        },
        {
          id: "publish",
          fields: [
            {
              type: "custom",
              title: "token",
              description:
                "The token required to publish workflows to the Smartblocks Store",
              options: {
                component: TokenPanel,
              },
            },
          ],
        },
      ],
    },
  });

  const tree = getTreeByPageName(CONFIG);
  const trigger =
    // getLegacy42Setting("SmartBlockTrigger") ||
    getSettingValueFromTree({
      tree,
      key: "trigger",
      defaultValue: "xx",
    })
      .replace(/"/g, "")
      .replace(/\\/, "\\\\")
      .trim();
  const triggerRegex = new RegExp(`${trigger}$`);
  const isCustomOnly = tree.some((t) =>
    toFlexRegex("custom only").test(t.text)
  );

  window.roamjs.extension.smartblocks = {};
  window.roamjs.extension.smartblocks.registerCommand = ({
    text,
    handler,
  }: {
    text: string;
    handler: CommandHandler;
  }) => {
    handlerByCommand[text] = handler;
  };
  Object.keys(window.roamjs.extension).forEach((text) => {
    if (window.roamjs.extension[text].registerSmartBlocksCommand) {
      window.roamjs.extension[text].registerSmartBlocksCommand();
      delete window.roamjs.extension[text];
    }
  });

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
        render({
          textarea,
          triggerLength: triggerRegex.source.replace("\\\\", "\\").length - 1,
          isCustomOnly,
        });
      }
    }
  });

  const runDaily = () => {
    const dailyConfig = tree.find((t) => toFlexRegex("daily").test(t.text));
    if (dailyConfig) {
      const time = getSettingValueFromTree({
        tree: dailyConfig.children,
        key: "time",
        defaultValue: "00:00",
      });
      const [hours, minutes] = time.split(":").map((s) => Number(s));
      const today = new Date();
      const triggerTime = addMinutes(
        addHours(startOfDay(today), hours),
        minutes
      );
      if (isBefore(today, triggerTime)) {
        const ms = differenceInMilliseconds(triggerTime, today);
        setTimeout(runDaily, ms + 1000);
      } else {
        const todayUid = toRoamDateUid(today);
        const childrenLength = getChildrenLengthByPageUid(todayUid);
        if (childrenLength === 0) {
          createPage({ title: toRoamDate(today) });
          const dailyWorkflowName = getSettingValueFromTree({
            tree: dailyConfig.children,
            key: "workflow name",
            defaultValue: "Daily",
          });
          const srcUid = getCustomWorkflows().find(
            ({ name }) => name === dailyWorkflowName
          )?.uid;
          if (srcUid) {
            const text = "Loading...";
            const targetUid = createBlock({
              node: { text },
              parentUid: todayUid,
            });
            setTimeout(
              () =>
                sbBomb({
                  srcUid,
                  target: { uid: targetUid, start: 0, end: text.length },
                }),
              1
            );
          } else {
            createBlock({
              node: {
                text: `RoamJS Error: Daily SmartBlocks enabled, but couldn't find SmartBlock Workflow named "${dailyWorkflowName}"`,
              },
              parentUid: todayUid,
            });
          }
        }
        const ms = differenceInMilliseconds(addDays(triggerTime, 1), today);
        setTimeout(runDaily, ms + 1000);
      }
    }
  };
  runDaily();

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Open SmartBlocks Store",
    callback: () => {
      const pageUid = getPageUidByPageTitle(CONFIG);
      const tree = getShallowTreeByParentUid(pageUid);
      const parentUid =
        tree?.find((t) => toFlexRegex("workflows").test(t.text))?.uid ||
        createBlock({ parentUid: pageUid, node: { text: "workflows" } });
      renderStore({ parentUid });
    },
  });

  const TAGS = new Set(["SmartBlock", "42SmartBlock"]);
  createHTMLObserver({
    className: "rm-page-ref--tag",
    tag: "SPAN",
    callback: (s: HTMLSpanElement) => {
      const dataTag = s.getAttribute("data-tag");
      if (TAGS.has(dataTag) && !s.hasAttribute("data-roamjs-smartblock-logo")) {
        s.setAttribute("data-roamjs-smartblock-logo", "true");
        const span = document.createElement("span");
        s.insertBefore(span, s.firstChild);
        span.onmousedown = (e) => e.stopPropagation();
        renderPopover(span);
      }
    },
  });

  createHTMLObserver({
    className: "bp3-button",
    tag: "BUTTON",
    callback: (b: HTMLButtonElement) => {
      const parentUid = getBlockUidFromTarget(b);
      if (parentUid && !b.hasAttribute("data-roamjs-smartblock-button")) {
        b.setAttribute("data-roamjs-smartblock-button", "true");
        const regex = new RegExp(
          `{{${b.textContent}:(?:42)?SmartBlock:(.*?)}}`
        );
        const text = getTextByBlockUid(parentUid);
        const match = regex.exec(text);
        if (match) {
          const { [1]: buttonText = "", index, [0]: full } = match;
          const [workflowName, args = ""] = buttonText.split(":");
          b.addEventListener("click", () => {
            const srcUid = getCustomWorkflows().find(
              ({ name }) => name === workflowName
            )?.uid;
            if (!srcUid) {
              createBlock({
                node: {
                  text: "Could not find custom workflow with the name:",
                  children: [{ text: workflowName }],
                },
                parentUid,
              });
            } else {
              const variables = Object.fromEntries(
                args
                  .split(",")
                  .map((v) => v.split("="))
                  .map(([k, v = ""]) => [k, v])
              );

              const keepButton =
                variables["RemoveButton"] === "false" ||
                variables["42RemoveButton"] === "false";

              const loadingText = "Loading...";
              if (keepButton) {
                const targetUid = createBlock({
                  node: { text: loadingText },
                  parentUid,
                });
                setTimeout(
                  () =>
                    sbBomb({
                      srcUid,
                      target: {
                        uid: targetUid,
                        start: 0,
                        end: loadingText.length,
                      },
                      variables,
                    }),
                  1
                );
              } else {
                updateBlock({
                  uid: parentUid,
                  text: `${text.substring(
                    0,
                    index
                  )}${loadingText}${text.substring(index + full.length)}`,
                });
                setTimeout(
                  () =>
                    sbBomb({
                      srcUid,
                      target: {
                        uid: parentUid,
                        start: index,
                        end: index + loadingText.length,
                      },
                      variables,
                    }),
                  1
                );
              }
            }
          });
          const img = new Image();
          img.src = lego;
          img.width = 17;
          img.height = 14;
          img.style.marginRight = "7px";
          b.insertBefore(img, b.firstChild);
        }
      }
    },
  });
});
