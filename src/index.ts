import {
  toConfig,
  runExtension,
  getTreeByPageName,
  getBlockUidsAndTextsReferencingPage,
  addStyle,
  toRoamDateUid,
  createPage,
  toRoamDate,
  createBlock,
  getPageUidByPageTitle,
  getShallowTreeByParentUid,
  createHTMLObserver,
  getBlockUidFromTarget,
  getTextByBlockUid,
  updateBlock,
  parseRoamDateUid,
} from "roam-client";
import {
  createConfigObserver,
  getSettingValueFromTree,
  setInputSetting,
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
  SmartBlocksContext,
  smartBlocksContext,
} from "./smartblocks";
import TokenPanel from "./TokenPanel";
import lego from "./img/lego3blocks.png";
import StripePanel from "./StripePanel";

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

.roamjs-smartblocks-store-item.roamjs-installed {
  cursor: auto;
}

.roamjs-smartblocks-store-item.roamjs-marketplace:hover,
.roamjs-smartblocks-store-item.roamjs-published:hover {
  box-shadow: 0px 3px 6px #00000040;
  transform: translate(0,-3px);
}

.roamjs-smartblocks-store-label .bp3-popover-wrapper {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.roamjs-smartblocks-store-tabs .bp3-tab-list {
  justify-content: space-around;
}

/* https://stripe.com/docs/connect/collect-then-transfer-guide#create-account */
a.stripe-connect {
  background: #635bff;
  display: inline-block;
  height: 38px;
  text-decoration: none;
  width: 180px;

  border-radius: 4px;
  -moz-border-radius: 4px;
  -webkit-border-radius: 4px;

  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;

  -webkit-font-smoothing: antialiased;
}

a.stripe-connect span {
  color: #ffffff;
  display: block;
  font-family: sohne-var, "Helvetica Neue", Arial, sans-serif;
  font-size: 15px;
  font-weight: 400;
  line-height: 14px;
  padding: 11px 0px 0px 24px;
  position: relative;
  text-align: left;
}

a.stripe-connect:hover {
  background: #7a73ff;
}

a.stripe-connect.disabled {
  background: #7a73ff;
  cursor: not-allowed;
}

.stripe-connect span::after {
  background-repeat: no-repeat;
  background-size: 49.58px;
  content: "";
  height: 20px;
  left: 62%;
  position: absolute;
  top: 28.95%;
  width: 49.58px;
}

/* Logos */
.stripe-connect span::after {
  background-image: url("data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!-- Generator: Adobe Illustrator 23.0.4, SVG Export Plug-In . SVG Version: 6.00 Build 0) --%3E%3Csvg version='1.1' id='Layer_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' viewBox='0 0 468 222.5' style='enable-background:new 0 0 468 222.5;' xml:space='preserve'%3E%3Cstyle type='text/css'%3E .st0%7Bfill-rule:evenodd;clip-rule:evenodd;fill:%23FFFFFF;%7D%0A%3C/style%3E%3Cg%3E%3Cpath class='st0' d='M414,113.4c0-25.6-12.4-45.8-36.1-45.8c-23.8,0-38.2,20.2-38.2,45.6c0,30.1,17,45.3,41.4,45.3 c11.9,0,20.9-2.7,27.7-6.5v-20c-6.8,3.4-14.6,5.5-24.5,5.5c-9.7,0-18.3-3.4-19.4-15.2h48.9C413.8,121,414,115.8,414,113.4z M364.6,103.9c0-11.3,6.9-16,13.2-16c6.1,0,12.6,4.7,12.6,16H364.6z'/%3E%3Cpath class='st0' d='M301.1,67.6c-9.8,0-16.1,4.6-19.6,7.8l-1.3-6.2h-22v116.6l25-5.3l0.1-28.3c3.6,2.6,8.9,6.3,17.7,6.3 c17.9,0,34.2-14.4,34.2-46.1C335.1,83.4,318.6,67.6,301.1,67.6z M295.1,136.5c-5.9,0-9.4-2.1-11.8-4.7l-0.1-37.1 c2.6-2.9,6.2-4.9,11.9-4.9c9.1,0,15.4,10.2,15.4,23.3C310.5,126.5,304.3,136.5,295.1,136.5z'/%3E%3Cpolygon class='st0' points='223.8,61.7 248.9,56.3 248.9,36 223.8,41.3 '/%3E%3Crect x='223.8' y='69.3' class='st0' width='25.1' height='87.5'/%3E%3Cpath class='st0' d='M196.9,76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7,15.9-6.3,19-5.2v-23C214.5,68.1,202.8,65.9,196.9,76.7z'/%3E%3Cpath class='st0' d='M146.9,47.6l-24.4,5.2l-0.1,80.1c0,14.8,11.1,25.7,25.9,25.7c8.2,0,14.2-1.5,17.5-3.3V135 c-3.2,1.3-19,5.9-19-8.9V90.6h19V69.3h-19L146.9,47.6z'/%3E%3Cpath class='st0' d='M79.3,94.7c0-3.9,3.2-5.4,8.5-5.4c7.6,0,17.2,2.3,24.8,6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6 C67.5,67.6,54,78.2,54,95.9c0,27.6,38,23.2,38,35.1c0,4.6-4,6.1-9.6,6.1c-8.3,0-18.9-3.4-27.3-8v23.8c9.3,4,18.7,5.7,27.3,5.7 c20.8,0,35.1-10.3,35.1-28.2C117.4,100.6,79.3,105.9,79.3,94.7z'/%3E%3C/g%3E%3C/svg%3E");
}

/* https://stripe.com/docs/connect/collect-then-transfer-guide?platform=web#accept-payment */
.StripeElement {
  height: 40px;
  padding: 10px 12px;
  width: 100%;
  color: #32325d;
  background-color: white;
  border: 1px solid transparent;
  border-radius: 4px;
  box-shadow: 0 1px 3px 0 #e6ebf1;
  -webkit-transition: box-shadow 150ms ease;
  transition: box-shadow 150ms ease;
}
.StripeElement--focus {
  box-shadow: 0 1px 3px 0 #cfd7df;
}
.StripeElement--invalid {
  border-color: #fa755a;
}
.StripeElement--webkit-autofill {
  background-color: #fefde5 !important;
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
            {
              title: "hide button icon",
              type: "flag",
              description:
                "If checked, there will no longer appear a SmartBlocks logo on SmartBlocks buttons",
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
            {
              type: "custom",
              title: "stripe",
              description:
                "Create a connected Stripe account to be able to sell workflows in the Store",
              options: {
                component: StripePanel,
              },
            },
          ],
        },
      ],
      versioning: true,
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
  const hideButtonIcon = tree.some((t) =>
    toFlexRegex("hide button icon").test(t.text)
  );
  const dailyConfig = tree.find((t) => toFlexRegex("daily").test(t.text));

  window.roamjs.extension.smartblocks = {};
  window.roamjs.extension.smartblocks.registerCommand = ({
    text,
    handler,
  }: {
    text: string;
    handler: (
      c: Pick<SmartBlocksContext, "targetUid" | "variables">
    ) => CommandHandler;
  }) => {
    handlerByCommand[text] = handler(smartBlocksContext);
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
          dailyConfig
        });
      }
    }
  });

  const runDaily = () => {
    if (dailyConfig) {
      const time = getSettingValueFromTree({
        tree: dailyConfig.children,
        key: "time",
        defaultValue: "00:00",
      });
      const latest = getSettingValueFromTree({
        tree: dailyConfig.children,
        key: "latest",
        defaultValue: "01-01-1970",
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
        const latestDate = parseRoamDateUid(latest);
        if (isBefore(startOfDay(latestDate), startOfDay(today))) {
          const dailyWorkflowName = getSettingValueFromTree({
            tree: dailyConfig.children,
            key: "workflow name",
            defaultValue: "Daily",
          });
          const srcUid = getCustomWorkflows().find(
            ({ name }) => name === dailyWorkflowName
          )?.uid;
          const todayUid = toRoamDateUid(today);
          if (srcUid) {
            createPage({ title: toRoamDate(today) });
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
          setInputSetting({
            blockUid: dailyConfig.uid,
            value: todayUid,
            key: "latest",
            index: 2,
          });
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

  createHTMLObserver({
    className: "rm-page-ref--tag",
    tag: "SPAN",
    callback: (s: HTMLSpanElement) => {
      const dataTag = s.getAttribute("data-tag");
      if (
        (dataTag === "SmartBlock" ||
          (dataTag === "42SmartBlock" && !window.roam42)) &&
        !s.hasAttribute("data-roamjs-smartblock-logo")
      ) {
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
          `{{${b.textContent}:SmartBlock:(.*?)}}`
          //`{{${b.textContent}:(?:42)?SmartBlock:(.*?)}}`
        );
        const text = getTextByBlockUid(parentUid);
        const match = regex.exec(text);
        if (match) {
          const { [1]: buttonText = "", index, [0]: full } = match;
          const [workflowName, args = ""] = buttonText.split(":");
          b.addEventListener("click", () => {
            const { uid: srcUid, name: srcName } = getCustomWorkflows().find(
              ({ name }) =>
                name.replace(/<%[A-Z]+%>/, "").trim() === workflowName
            );
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
                  .filter((s) => !!s)
                  .map((v) => v.split("="))
                  .map(([k, v = ""]) => [k, v])
              );

              const keepButton =
                variables["RemoveButton"] === "false" ||
                variables["42RemoveButton"] === "false";

              const loadingText = "Loading...";
              const props = {
                srcUid,
                variables,
                mutableCursor: !srcName.includes("<%NOCURSOR%>"),
              };
              if (keepButton) {
                const targetUid = createBlock({
                  node: { text: loadingText },
                  parentUid,
                });
                setTimeout(
                  () =>
                    sbBomb({
                      ...props,
                      target: {
                        uid: targetUid,
                        start: 0,
                        end: loadingText.length,
                      },
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
                      ...props,
                      target: {
                        uid: parentUid,
                        start: index,
                        end: index + loadingText.length,
                      },
                    }),
                  1
                );
              }
            }
          });
          if (!hideButtonIcon) {
            const img = new Image();
            img.src = lego;
            img.width = 17;
            img.height = 14;
            img.style.marginRight = "7px";
            b.insertBefore(img, b.firstChild);
          }
        }
      }
    },
  });
});
