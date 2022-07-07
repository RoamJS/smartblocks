import toConfigPageName from "roamjs-components/util/toConfigPageName";
import runExtension from "roamjs-components/util/runExtension";
import getBlockUidsAndTextsReferencingPage from "roamjs-components/queries/getBlockUidsAndTextsReferencingPage";
import addStyle from "roamjs-components/dom/addStyle";
import createPage from "roamjs-components/writes/createPage";
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
  COMMANDS,
  getCleanCustomWorkflows,
  getCustomWorkflows,
  handlerByCommand,
  proccessBlockText,
  sbBomb,
  smartBlocksContext,
} from "./core";
import lego from "./img/lego3blocks.png";
import { Intent } from "@blueprintjs/core";
import HotKeyPanel, { SmartblockHotKeys } from "./HotKeyPanel";
import XRegExp from "xregexp";
import React from "react";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import CustomPanel from "roamjs-components/components/ConfigPanels/CustomPanel";
import TimePanel from "roamjs-components/components/ConfigPanels/TimePanel";
import apiPut from "roamjs-components/util/apiPut";
import type {
  CustomField,
  Field,
} from "roamjs-components/components/ConfigPanels/types";

const getLegacy42Setting = (name: string) => {
  const settings = Object.fromEntries(
    getBlockUidsAndTextsReferencingPage("42Setting").map(({ text, uid }) => {
      const [_, name, value] = text.trim().split(/\s/);
      return [name, { value, uid }];
    })
  );
  return (settings[name]?.value || "").replace(/"/g, "").trim();
};

const extensionId = "smartblocks";
const CONFIG = toConfigPageName(extensionId);
const COMMAND_ENTRY_REGEX = /<%$/;
const COLORS = ["darkblue", "darkred", "darkgreen", "darkgoldenrod"];
export default runExtension({
  extensionId,
  run: async () => {
    const smartblockHotKeys: SmartblockHotKeys = {
      uidToMapping: {},
      mappingToBlock: {},
    };
    const nextDailyRun: { current: string; timeout: number } = {
      current: "Unscheduled",
      timeout: 0,
    };
    const style = addStyle(`.roamjs-smartblocks-popover-target {
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
  padding: 4px 12px 0;
  cursor: pointer;
  font-size: 12px;   
  border: 1px solid #10161a26;
  background: white;
  border-radius: 24px;
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
  height: 48px;
}

.roamjs-smartblock-hotkey-block {
  max-width: 160px;
  width: 160px;
  min-width: 160px;
  margin: 0 4px;
}

.roamjs-smartblock-menu {
  width: 300px;
}`);
    const { pageUid, observer: configObserver } = await createConfigObserver({
      title: CONFIG,
      config: {
        tabs: [
          {
            id: "home",
            fields: [
              {
                Panel: TextPanel,
                title: "trigger",
                description:
                  "The key combination to used to pull up the smart blocks menu",
                defaultValue: "jj",
              },
              {
                title: "custom only",
                Panel: FlagPanel,
                description:
                  "If checked, will exclude all the predefined workflows from Smart Blocks Menu",
              },
              {
                title: "hide button icon",
                Panel: FlagPanel,
                description:
                  "If checked, there will no longer appear a SmartBlocks logo on SmartBlocks buttons",
              },
              {
                title: "hot keys",
                description:
                  "Map specific Smartblock workflows to a given hot key, with either an input combination or global modifier",
                options: {
                  component: HotKeyPanel(smartblockHotKeys),
                },
                Panel: CustomPanel,
              } as Field<CustomField>,
              {
                title: "highlighting",
                Panel: FlagPanel,
                description:
                  "Uses command highlighting to help write SmartBlock Workflows",
              },
            ],
          },
          {
            id: "daily",
            fields: [
              {
                Panel: TextPanel,
                title: "workflow name",
                description:
                  "The workflow name used to automatically trigger on each day's daily note page.",
                defaultValue: "Daily",
              },
              {
                Panel: TimePanel,
                title: "time",
                description:
                  "The time (24hr format) when the daily workflow is triggered each day.",
              },
              {
                title: "scheduled",
                description:
                  "Tells you when the next Daily Smartblock is currently scheduled to fire",
                options: {
                  component: () =>
                    React.createElement("p", {}, nextDailyRun.current),
                },
                Panel: CustomPanel,
              } as Field<CustomField>,
            ],
            toggleable: true,
          },
          {
            id: "publish",
            fields: [
              {
                Panel: TextPanel,
                title: "display name",
                description:
                  "The display name that will appear in the store next to your workflow. By default, your display name in Roam will be shown. If not set, then your graph name will be shown.",
                defaultValue: getDisplayNameByUid(getCurrentUserUid()),
              },
            ],
          },
        ],
        versioning: true,
      },
    });

    const tree = getBasicTreeByParentUid(pageUid);
    const isCustomOnly = tree.some((t) =>
      toFlexRegex("custom only").test(t.text)
    );
    const hideButtonIcon = tree.some((t) =>
      toFlexRegex("hide button icon").test(t.text)
    );
    const dailyConfig = getSubTree({ tree, key: "daily" });
    const hotkeyConfig = getSubTree({ tree, key: "hot keys" });
    hotkeyConfig.children.forEach(({ uid, text, children }) => {
      smartblockHotKeys.uidToMapping[uid] = text;
      smartblockHotKeys.mappingToBlock[text] = children?.[0]?.text;
    });
    const highlighting = getSubTree({ tree, key: "highlighting" });
    const customCommands: { text: string; help: string }[] = [];

    window.roamjs.extension.smartblocks = {
      registerCommand: ({
        text,
        help = `Description for ${text}`,
        handler,
        delayArgs,
      }) => {
        const command = text.toUpperCase();
        handlerByCommand[command] = {
          handler: (...args) =>
            handler({ ...smartBlocksContext, proccessBlockText })(...args),
          delayArgs,
        };
        customCommands.push({ text: command, help });
      },
      unregisterCommand: (text: string) => {
        const command = text.toUpperCase();
        delete handlerByCommand[command];
        customCommands.splice(
          customCommands.findIndex((c) => c.text === command),
          1
        );
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
            throw new Error(
              "Either the `srcName` or `srcUid` input is required"
            );
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
    const triggerRegex = new RegExp(`${trigger}(.*)$`);
    let menuLoaded = false;

    const documentInputListener = (e: InputEvent) => {
      const target = e.target as HTMLElement;
      if (
        !menuLoaded &&
        target.tagName === "TEXTAREA" &&
        target.classList.contains("rm-block-input")
      ) {
        const textarea = target as HTMLTextAreaElement;
        const location = window.roamAlphaAPI.ui.getFocusedBlock();
        const valueToCursor = textarea.value.substring(
          0,
          textarea.selectionStart
        );
        const match = triggerRegex.exec(valueToCursor);
        if (match) {
          menuLoaded = true;
          render({
            textarea,
            triggerRegex,
            triggerStart: match.index,
            isCustomOnly,
            dailyConfig,
            onClose: () => {
              menuLoaded = false;
            },
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
              .find(([k]) =>
                new RegExp(`${k.join("")}$`).test(valueToCursor)
              ) || [];
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
    };
    document.addEventListener("input", documentInputListener);

    const appRoot = document.querySelector<HTMLDivElement>(".roam-app");
    const appRootKeydownListener = async (e: KeyboardEvent) => {
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
    };
    appRoot?.addEventListener("keydown", appRootKeydownListener);

    const runDaily = () => {
      if (!!dailyConfig.uid) {
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
          nextDailyRun.timeout = window.setTimeout(runDaily, ms + 1000);
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
          const todayUid = window.roamAlphaAPI.util.dateToPageUid(today);
          apiPut<{ oldDate: string; uuid: string }>({
            path: `smartblocks-daily`,
            data: {
              newDate: todayUid,
              uuid: latest.length < 36 ? undefined : latest,
            },
            anonymous: true,
          })
            .then((r) => {
              const latestUid = r.oldDate || latest;
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
                  createPage({
                    title: window.roamAlphaAPI.util.dateToPageTitle(today),
                  }).then(() =>
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
                  value: r.uuid,
                  key: "latest",
                  index: 2,
                });
              }
              const nextRun = addSeconds(addDays(triggerTime, 1), 1);
              const ms = differenceInMilliseconds(nextRun, today);
              nextDailyRun.timeout = window.setTimeout(runDaily, ms);
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

    const OPEN_SMARTBLOCK_STORE_COMMAND_LABEL = "Open SmartBlocks Store";
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: OPEN_SMARTBLOCK_STORE_COMMAND_LABEL,
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

    const RUN_MULTIPLE_SMARTBLOCKS_COMMAND_LABEL = "Run Multiple SmartBlocks";
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: RUN_MULTIPLE_SMARTBLOCKS_COMMAND_LABEL,
      callback: () => {
        const parentUid =
          window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
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

    const logoObserver = createHTMLObserver({
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

    const buttonLogoObserver = createHTMLObserver({
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

    const highlightingObservers = !!highlighting.uid
      ? createBlockObserver((b) => {
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
              : [
                  {
                    name: "text",
                    value: s,
                    start: offset,
                    end: offset + s.length,
                  },
                ];
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
                    m.end > totalCount &&
                    m.start < totalCount + t.nodeValue.length
                )
                .map((m) => {
                  const overlap = t.nodeValue.substring(
                    Math.max(0, m.start - totalCount),
                    Math.min(t.nodeValue.length, m.end - totalCount)
                  );
                  if (m.name === "text")
                    return document.createTextNode(overlap);
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
        })
      : [];

    return {
      elements: [style],
      observers: [
        configObserver,
        logoObserver,
        buttonLogoObserver,
        ...highlightingObservers,
      ],
      domListeners: [
        { type: "input", listener: documentInputListener, el: document },
        { type: "keydown", el: appRoot, listener: appRootKeydownListener },
      ],
      timeouts: [nextDailyRun],
      commands: [
        OPEN_SMARTBLOCK_STORE_COMMAND_LABEL,
        RUN_MULTIPLE_SMARTBLOCKS_COMMAND_LABEL,
      ],
    };
  },
  unload: () => {
    delete window.roamjs.extension.smartblocks;
  },
});
