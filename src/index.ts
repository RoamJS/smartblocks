import toConfigPageName from "roamjs-components/util/toConfigPageName";
import runExtension from "roamjs-components/util/runExtension";
import getBlockUidsAndTextsReferencingPage from "roamjs-components/queries/getBlockUidsAndTextsReferencingPage";
import addStyle from "roamjs-components/dom/addStyle";
import toRoamDateUid from "roamjs-components/date/toRoamDateUid";
import createPage from "roamjs-components/writes/createPage";
import toRoamDate from "roamjs-components/date/toRoamDate";
import createBlock from "roamjs-components/writes/createBlock";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import parseRoamDateUid from "roamjs-components/date/parseRoamDateUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getUids from "roamjs-components/dom/getUids";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import createBlockObserver from "roamjs-components/dom/createBlockObserver";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import { createConfigObserver } from "roamjs-components/components/ConfigPage";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import { render as renderCursorMenu } from "roamjs-components/components/CursorMenu";
import { render as renderToast } from "roamjs-components/components/Toast";
import setInputSetting from "roamjs-components/util/setInputSetting";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import addDays from "date-fns/addDays";
import addHours from "date-fns/addHours";
import addMinutes from "date-fns/addMinutes";
import addSeconds from "date-fns/addSeconds";
import startOfDay from "date-fns/startOfDay";
import isBefore from "date-fns/isBefore";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";
import dateFnsFormat from "date-fns/format";
import { render } from "./SmartblocksMenu";
import { render as renderStore } from "./SmartblocksStore";
import { render as renderPopover } from "./SmartblockPopover";
import { render as renderBulk } from "./BulkTrigger";
import {
  CommandHandler,
  COMMANDS,
  getCleanCustomWorkflows,
  getCustomWorkflows,
  handlerByCommand,
  sbBomb,
  SmartBlocksContext,
  smartBlocksContext,
} from "./smartblocks";
import TokenPanel from "./TokenPanel";
import ReviewPanel from "./ReviewPanel";
import lego from "./img/lego3blocks.png";
import StripePanel from "./StripePanel";
import { Intent } from "@blueprintjs/core";
import HotKeyPanel, { SmartblockHotKeys } from "./HotKeyPanel";
import XRegExp from "xregexp";
import axios from "axios";
import React from "react";

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
  border: 1px solid #10161a26;
  background: white;
}

.roamjs-smartblocks-store-item:hover {
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

.roamjs-smartblocks-store-tabs {
  height: 84px;
}

.roamjs-smartblock-hotkey-block {
  max-width: 160px;
  width: 160px;
  min-width: 160px;
  margin: 0 4px;
}

.roamjs-smartblock-workflow-review {
  z-index: 2100;
}

.roamjs-smartblock-workflow-review .bp3-dialog {
  position: absolute;
  top: 32px;
  bottom: 32px;
  left: 32px;
  right: 32px;
  width: unset;
  box-shadow: none;
  align-items: center;
  justify-content: center;
}

.roamjs-smartblock-workflow-review .bp3-dialog-header {
  width: 100%;
}

.roamjs-smartblock-menu {
  width: 300px;
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
  width: 100%;
  color: #32325d;
  border: 1px solid transparent;
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
const CONFIG = toConfigPageName(ID);
const COMMAND_ENTRY_REGEX = /<%$/;
const smartblockHotKeys: SmartblockHotKeys = {
  uidToMapping: {},
  mappingToBlock: {},
};
const COLORS = ["darkblue", "darkred", "darkgreen", "darkgoldenrod"];
const nextDailyRun: { current: string } = { current: "Unscheduled" };
runExtension("smartblocks", async () => {
  const { pageUid } = await createConfigObserver({
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
              defaultValue: "jj",
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
            {
              title: "hot keys",
              type: "custom",
              description:
                "Map specific Smartblock workflows to a given hot key, with either an input combination or global modifier",
              options: {
                component: HotKeyPanel(smartblockHotKeys),
              },
            },
            {
              title: "highlighting",
              type: "flag",
              description:
                "Uses command highlighting to help write SmartBlock Workflows",
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
            {
              type: "custom",
              title: "scheduled",
              description:
                "Tells you when the next Daily Smartblock is currently scheduled to fire",
              options: {
                component: () =>
                  React.createElement("p", {}, nextDailyRun.current),
              },
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
            {
              type: "text",
              title: "display name",
              description:
                "The display name that will appear in the store next to your workflow. By default, your display name in Roam will be shown. If not set, then your graph name will be shown.",
              defaultValue: getDisplayNameByUid(getCurrentUserUid()),
            },
            {
              title: "review",
              type: "custom",
              description: "Smartblock workflows under review",
              options: {
                component: ReviewPanel,
              },
            },
          ],
        },
      ],
      versioning: true,
    },
  });

  const tree = getBasicTreeByParentUid(pageUid);
  const trigger = (
    getLegacy42Setting("SmartBlockTrigger") ||
    getSettingValueFromTree({
      tree,
      key: "trigger",
      defaultValue: "jj",
    })
  )
    .replace(/"/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\+/g, "\\+")
    .trim();
  const triggerRegex = new RegExp(`${trigger}$`);
  const isCustomOnly = tree.some((t) =>
    toFlexRegex("custom only").test(t.text)
  );
  const hideButtonIcon = tree.some((t) =>
    toFlexRegex("hide button icon").test(t.text)
  );
  const dailyConfig = tree.find((t) => toFlexRegex("daily").test(t.text));
  const hotkeyConfig = getSubTree({ tree, key: "hot keys" });
  hotkeyConfig.children.forEach(({ uid, text, children }) => {
    smartblockHotKeys.uidToMapping[uid] = text;
    smartblockHotKeys.mappingToBlock[text] = children?.[0]?.text;
  });
  const highlighting = tree.some((t) =>
    toFlexRegex("highlighting").test(t.text)
  );
  const customCommands: { text: string; help: string }[] = [];

  window.roamjs.extension.smartblocks = {
    registerCommand: ({
      text,
      help = `Description for ${text}`,
      handler,
      delayArgs,
    }) => {
      const command = text.toUpperCase();
      handlerByCommand[command] = { handler: handler(smartBlocksContext), delayArgs };
      customCommands.push({ text: command, help });
    },
    triggerSmartblock: ({
      srcName,
      srcUid = getCleanCustomWorkflows().find(({ name }) => name === srcName)
        ?.uid,
      targetName,
      targetUid = getPageUidByPageTitle(targetName),
      variables,
    }) => {
      if (!srcUid) {
        if (srcName) {
          throw new Error(`Could not find workflow with name ${srcName}`);
        } else {
          throw new Error("Either the `srcName` or `srcUid` input is required");
        }
      }
      if (!targetUid) {
        if (targetName) {
          throw new Error(`Could not find page with name ${targetName}`);
        } else {
          throw new Error(
            "Either the `targetName` or `targetUid` input is required"
          );
        }
      }
      return new Promise((resolve) =>
        setTimeout(
          () =>
            sbBomb({
              srcUid,
              target: {
                uid: targetUid,
                isPage: !!(targetName || getPageTitleByPageUid(targetUid)),
              },
              variables,
            }).then(resolve),
          10
        )
      );
    },
  };

  document.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "TEXTAREA" &&
      target.classList.contains("rm-block-input")
    ) {
      const textarea = target as HTMLTextAreaElement;
      const location = window.roamAlphaAPI.ui.getFocusedBlock();
      const valueToCursor = textarea.value.substring(
        0,
        textarea.selectionStart
      );
      if (triggerRegex.test(valueToCursor)) {
        render({
          textarea,
          triggerLength:
            triggerRegex.source.replace("\\\\", "\\").replace(/\\\+/g, "+")
              .length - 1,
          isCustomOnly,
          dailyConfig,
        });
      } else if (COMMAND_ENTRY_REGEX.test(valueToCursor)) {
        renderCursorMenu({
          initialItems: COMMANDS.map(({ text, help }) => ({
            text,
            id: text,
            help,
          })).concat([
            {
              text: "NOCURSOR",
              id: "NOCURSOR",
              help: "Workflow modifier that removes the cursor from Roam Blocks at the end of the workflow",
            },
            {
              text: "HIDE",
              id: "HIDE",
              help: "Workflow modifier that hides this workflow from the standard SmartBlock menu execution",
            },
            ...customCommands.map(({ text, help }) => ({
              text,
              id: text,
              help,
            })),
          ]),
          onItemSelect: async (item) => {
            const { blockUid } = getUids(textarea);
            const suffix = textarea.value.substring(textarea.selectionStart);
            const newPrefix = `${valueToCursor.slice(0, -2)}<%${item.text}%>`;
            await updateBlock({
              uid: blockUid,
              text: `${newPrefix}${suffix}`,
            });
            renderToast({
              intent: Intent.PRIMARY,
              id: "smartblocks-command-help",
              content: `###### ${item.text}\n\n${item.help}`,
              position: "bottom-right",
              timeout: 10000,
            });
            await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
              location,
              selection: { start: newPrefix.length - 2 },
            });
          },
          textarea,
        });
      } else {
        const [k, srcUid] =
          Object.entries(smartblockHotKeys.mappingToBlock)
            .map(([k, uid]) => [k.split("+"), uid] as const)
            .filter(([k]) => k.every((l) => l.length === 1))
            .find(([k]) => new RegExp(`${k.join("")}$`).test(valueToCursor)) ||
          [];
        if (srcUid) {
          sbBomb({
            srcUid,
            target: {
              uid: getUids(textarea).blockUid,
              start: textarea.selectionStart - k.length,
              end: textarea.selectionStart,
            },
            mutableCursor: true,
          });
        }
      }
    }
  });

  const appRoot = document.querySelector<HTMLDivElement>(".roam-app");
  if (appRoot) {
    appRoot.addEventListener("keydown", async (e) => {
      const modifiers = new Set();
      if (e.altKey) modifiers.add("alt");
      if (e.shiftKey) modifiers.add("shift");
      if (e.ctrlKey) modifiers.add("control");
      if (e.metaKey) modifiers.add("meta");
      if (modifiers.size) {
        const mapping = Array.from(modifiers)
          .sort()
          .concat(e.key.toLowerCase())
          .join("+");
        const srcUid = smartblockHotKeys.mappingToBlock[mapping];
        if (srcUid) {
          e.preventDefault();
          e.stopPropagation();
          const target =
            window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"] ||
            (await createBlock({
              node: { text: "" },
              parentUid: getCurrentPageUid(),
            }));
          const start = getTextByBlockUid(target).length;
          sbBomb({
            srcUid,
            target: {
              uid: target,
              start,
              end: start,
            },
            mutableCursor: true,
          });
        }
      }
    });
  }

  const runDaily = () => {
    if (dailyConfig) {
      const dailyChildren = getBasicTreeByParentUid(dailyConfig.uid);
      const time = getSettingValueFromTree({
        tree: dailyChildren,
        key: "time",
        defaultValue: "00:00",
      });
      const latest = getSettingValueFromTree({
        tree: dailyChildren,
        key: "latest",
        defaultValue: "01-01-1970",
      });
      const debug = !!getSubTree({ tree: dailyChildren, key: "debug" }).uid;
      const [hours, minutes] = time.split(":").map((s) => Number(s));
      const today = new Date();
      const triggerTime = addMinutes(
        addHours(startOfDay(today), hours),
        minutes
      );
      if (isBefore(today, triggerTime)) {
        const ms = differenceInMilliseconds(triggerTime, today);
        setTimeout(runDaily, ms + 1000);
        if (debug) {
          renderToast({
            id: "smartblocks-info",
            content: `Smartblocks: Still need to run the Smartblock later today at: ${dateFnsFormat(
              triggerTime,
              "hh:mm:ss a"
            )}`,
            intent: Intent.PRIMARY,
          });
        }
      } else {
        if (debug) {
          renderToast({
            id: "smartblocks-info",
            content: `Smartblocks: It's after your trigger time, checking to see if we should run today...`,
            intent: Intent.PRIMARY,
          });
        }
        const todayUid = toRoamDateUid(today);
        axios
          .put(`${process.env.API_URL}/smartblocks-daily`, {
            newDate: todayUid,
            uuid: latest.length < 36 ? undefined : latest,
          })
          .then((r) => {
            const latestUid = r.data.oldDate || latest;
            const latestDate = latestUid
              ? parseRoamDateUid(latestUid)
              : new Date(1970, 0, 1);
            if (isBefore(startOfDay(latestDate), startOfDay(today))) {
              const dailyWorkflowName = getSettingValueFromTree({
                tree: dailyChildren,
                key: "workflow name",
                defaultValue: "Daily",
              });
              const srcUid = getCleanCustomWorkflows().find(
                ({ name }) => name === dailyWorkflowName
              )?.uid;
              if (srcUid) {
                if (debug) {
                  renderToast({
                    id: "smartblocks-info",
                    content: `Smartblocks: About to run Daily SmartBlock: ${dailyWorkflowName}!`,
                    intent: Intent.PRIMARY,
                  });
                }
                createPage({ title: toRoamDate(today) }).then(() =>
                  sbBomb({
                    srcUid,
                    target: { uid: todayUid, isPage: true },
                  })
                );
              } else {
                renderToast({
                  id: "smartblocks-error",
                  content: `RoamJS Error: Daily SmartBlocks enabled, but couldn't find SmartBlock Workflow named "${dailyWorkflowName}"`,
                  intent: Intent.DANGER,
                });
              }
            } else if (debug) {
              renderToast({
                id: "smartblocks-info",
                content: `Smartblocks: No need to run daily workflow on ${todayUid}. Last run on ${latestUid}.`,
                intent: Intent.PRIMARY,
              });
            }
            if (latest.length < 36) {
              setInputSetting({
                blockUid: dailyConfig.uid,
                value: r.data.uuid,
                key: "latest",
                index: 2,
              });
            }
            const nextRun = addSeconds(addDays(triggerTime, 1), 1);
            const ms = differenceInMilliseconds(nextRun, today);
            setTimeout(runDaily, ms);
            nextDailyRun.current = `Next Daily SmartBlock scheduled to run at ${dateFnsFormat(
              nextRun,
              "yyyy-MM-dd hh:mm:ss a"
            )}`;
          })
          .catch((e) =>
            renderToast({
              id: "smartblocks-error",
              content: `Smartblocks Daily Workflow Error: ${e.message}`,
              intent: Intent.DANGER,
            })
          );
      }
    }
  };
  runDaily();

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Open SmartBlocks Store",
    callback: async () => {
      const pageUid = getPageUidByPageTitle(CONFIG);
      const tree = getShallowTreeByParentUid(pageUid);
      const parentUid =
        tree?.find((t) => toFlexRegex("workflows").test(t.text))?.uid ||
        (await createBlock({
          parentUid: pageUid,
          node: { text: "workflows" },
        }));
      renderStore({ parentUid });
    },
  });

  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: "Run Multiple SmartBlocks",
    callback: () => {
      const parentUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      renderBulk({
        initialLocations: parentUid
          ? window.roamAlphaAPI
              .q(
                `[:find (pull ?p [:node/title]) :where [?b :block/uid "${parentUid}"] [?c :block/parents ?b] [?c :block/refs ?p]]`
              )
              .map((a) => a[0]?.title as string)
          : [],
      });
    },
  });

  createHTMLObserver({
    className: "rm-page-ref--tag",
    tag: "SPAN",
    callback: (s: HTMLSpanElement) => {
      const dataTag = s.getAttribute("data-tag");
      if (
        (dataTag === "SmartBlock" || dataTag === "42SmartBlock") &&
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
        // We include textcontent here bc there could be multiple smartblocks in a block
        const regex = new RegExp(
          `{{${b.textContent}:(?:42)?SmartBlock:(.*?)}}`
        );
        const text = getTextByBlockUid(parentUid);
        const match = regex.exec(text);
        if (match) {
          const { [1]: buttonText = "", index, [0]: full } = match;
          const [workflowName, args = ""] = buttonText.split(":");
          b.addEventListener("click", () => {
            const workflows = getCustomWorkflows();
            const { uid: srcUid } = getCleanCustomWorkflows(workflows).find(
              ({ name }) => name === workflowName
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

              const clearBlock = variables["Clear"] === "true";

              const props = {
                srcUid,
                variables,
                mutableCursor: !(
                  workflows.find((w) => w.uid === srcUid)?.name || ""
                ).includes("<%NOCURSOR%>"),
                triggerUid: parentUid,
              };
              if (keepButton) {
                createBlock({
                  node: { text: "" },
                  parentUid,
                }).then((targetUid) =>
                  sbBomb({
                    ...props,
                    target: {
                      uid: targetUid,
                      start: 0,
                      end: 0,
                    },
                  }).then((n) => n === 0 && deleteBlock(targetUid))
                );
              } else {
                updateBlock({
                  uid: parentUid,
                  text: clearBlock
                    ? ""
                    : `${text.substring(0, index)}${text.substring(
                        index + full.length
                      )}`,
                }).then(() =>
                  sbBomb({
                    ...props,
                    target: {
                      uid: parentUid,
                      start: index,
                      end: index,
                    },
                  })
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

  if (highlighting) {
    createBlockObserver((b) => {
      let colorIndex = 0;
      const flattenTextNodes = (c: ChildNode): ChildNode[] =>
        c.nodeName === "#text"
          ? [c]
          : Array.from(c.childNodes).flatMap(flattenTextNodes);
      const textNodes = flattenTextNodes(b).filter(
        (t) => !t.parentElement.closest(".CodeMirror")
      );
      const getMatches = (
        s: string,
        offset: number
      ): XRegExp.MatchRecursiveValueNameMatch[] => {
        const matches = XRegExp.matchRecursive(s, "<%[A-Z]+:?", "%>", "g", {
          valueNames: ["text", "left", "args", "right"],
          unbalanced: "skip",
        });
        const someMatches = matches.length
          ? matches.map((m) => ({
              ...m,
              start: m.start + offset,
              end: m.end + offset,
            }))
          : [{ name: "text", value: s, start: offset, end: offset + s.length }];
        return someMatches.flatMap((m) =>
          m.name === "args" ? getMatches(m.value, m.start) : m
        );
      };
      const matches = getMatches(
        textNodes.map((t) => t.nodeValue).join(""),
        0
      ).filter((m) => m.end > m.start);
      let totalCount = 0;
      if (matches.length > 1) {
        textNodes.forEach((t) => {
          matches
            .filter(
              (m) =>
                m.end > totalCount && m.start < totalCount + t.nodeValue.length
            )
            .map((m) => {
              const overlap = t.nodeValue.substring(
                Math.max(0, m.start - totalCount),
                Math.min(t.nodeValue.length, m.end - totalCount)
              );
              if (m.name === "text") return document.createTextNode(overlap);
              if (m.name === "left") {
                const span = document.createElement("span");
                span.style.color = COLORS[colorIndex % COLORS.length];
                span.innerText = overlap;
                colorIndex++;
                return span;
              }
              if (m.name === "right") {
                const span = document.createElement("span");
                if (colorIndex > 0) {
                  colorIndex--;
                  span.style.color = COLORS[colorIndex % COLORS.length];
                }
                span.innerText = overlap;
                return span;
              }
              return null;
            })
            .filter((s) => !!s)
            .forEach((s) => t.parentElement.insertBefore(s, t));
          totalCount += t.nodeValue.length;
          t.nodeValue = "";
        });
      }
    });
  }
});
