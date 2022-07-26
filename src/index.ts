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
import getUids from "roamjs-components/dom/getUids";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import createBlockObserver from "roamjs-components/dom/createBlockObserver";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
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
import { Intent } from "@blueprintjs/core";
import HotKeyPanel from "./HotKeyPanel";
import XRegExp from "xregexp";
import apiPut from "roamjs-components/util/apiPut";
import { addTokenDialogCommand } from "roamjs-components/components/TokenDialog";
import migrateLegacySettings from "roamjs-components/util/migrateLegacySettings";
import DailyConfig from "./DailyConfig";

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
  migratedTo: "SmartBlocks",
  extensionId,
  run: async ({ extensionAPI }) => {
    migrateLegacySettings({
      extensionAPI,
      extensionId,
      specialKeys: {
        "hot keys": (n) =>
          Object.fromEntries(
            n.children.map((c) => [c.text, c.children[0]?.text])
          ),
        daily: (n) => {
          return {
            "workflow name": getSettingValueFromTree({
              tree: n.children,
              key: "workflow name",
            }),
            latest: getSettingValueFromTree({
              tree: n.children,
              key: "latest",
            }),
            time: getSettingValueFromTree({ tree: n.children, key: "time" }),
          };
        },
      },
    });
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

.roamjs-smartblock-menu {
  width: 300px;
}`);

    const toggleCommandPalette = (flag: boolean) => {
      const workflows = getCleanCustomWorkflows();
      if (flag) {
        workflows.forEach((wf) => {
          window.roamAlphaAPI.ui.commandPalette.addCommand({
            label: `Trigger SmartBlock: ${wf.name}`,
            callback: () => {
              const targetUid =
                window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
              if (targetUid) {
                sbBomb({
                  srcUid: wf.uid,
                  target: { uid: targetUid, isPage: false },
                });
              } else {
                window.roamAlphaAPI.ui.mainWindow
                  .getOpenPageOrBlockUid()
                  .then((uid) =>
                    sbBomb({
                      srcUid: wf.uid,
                      target: { uid, isPage: true },
                    })
                  );
              }
            },
          });
        });
      } else {
        workflows.forEach((wf) => {
          window.roamAlphaAPI.ui.commandPalette.removeCommand({
            label: `Trigger SmartBlock: ${wf.name}`,
          });
        });
      }
    };

    let trigger = "jj";
    let triggerRegex = /$^/;
    const refreshTrigger = (value: string) => {
      trigger = (getLegacy42Setting("SmartBlockTrigger") || value || "jj")
        .replace(/"/g, "")
        .replace(/\\/g, "\\\\")
        .replace(/\+/g, "\\+")
        .trim();
      triggerRegex = new RegExp(`${trigger}(.*)$`);
    };

    let isCustomOnly = extensionAPI.settings.get("custom-only") as boolean;
    let hideButtonIcon = extensionAPI.settings.get(
      "hide-button-icon"
    ) as boolean;
    let highlighting = extensionAPI.settings.get("highlighting") as boolean;
    const defaultDisplayName = getDisplayNameByUid(getCurrentUserUid());
    let displayName = defaultDisplayName;

    extensionAPI.settings.panel.create({
      tabTitle: "SmartBlocks",
      settings: [
        {
          id: "command-palette",
          name: "Command Palette",
          description:
            "Whether or not your custom workflows are accessible from Roam's command palette",
          action: {
            type: "switch",
            onChange: (e) =>
              toggleCommandPalette((e.target as HTMLInputElement).checked),
          },
        },
        {
          action: {
            type: "input",
            onChange: (e) => refreshTrigger(e.target.value),
            placeholder: "jj",
          },
          id: "trigger",
          name: "Trigger",
          description:
            "The key combination to used to pull up the smart blocks menu",
        },
        {
          id: "custom-only",
          name: "Custom Only",
          action: {
            type: "switch",
            onChange: (e) => (isCustomOnly = e.target.checked),
          },
          description:
            "If checked, will exclude all the predefined workflows from Smart Blocks Menu",
        },
        {
          id: "hide-button-icon",
          name: "Hide Button Icon",
          action: {
            type: "switch",
            onChange: (e) => (hideButtonIcon = e.target.checked),
          },
          description:
            "If checked, there will no longer appear a SmartBlocks logo on SmartBlocks buttons",
        },
        {
          id: "hot-keys",
          name: "Hot Keys",
          description:
            "Map specific Smartblock workflows to a given hot key, with either an input combination or global modifier",
          action: {
            type: "reactComponent",
            component: HotKeyPanel(extensionAPI),
          },
        },
        {
          id: "highlighting",
          name: "Highlighting",
          action: {
            type: "switch",
            onChange: (e) => (highlighting = e.target.checked),
          },
          description:
            "Uses command highlighting to help write SmartBlock Workflows",
        },
        {
          action: {
            type: "input",
            onChange: (e) => (displayName = e.target.value),
            placeholder: defaultDisplayName,
          },
          id: "display-name",
          name: "Display Name",
          description:
            "The display name that will appear in the store next to your workflow. By default, your display name in Roam will be shown. If not set, then your graph name will be shown.",
        },
        {
          id: "daily",
          name: "Daily",
          description:
            "Enable to trigger a given workflow at a certain time on each day",
          action: {
            type: "reactComponent",
            component: DailyConfig(extensionAPI),
          },
        },
      ],
    });
    toggleCommandPalette(!!extensionAPI.settings.get("command-palette"));
    refreshTrigger(extensionAPI.settings.get("trigger") as string);

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
            extensionAPI,
            onClose: () => {
              menuLoaded = false;
            },
          });
        } else if (COMMAND_ENTRY_REGEX.test(valueToCursor)) {
          renderCursorMenu({
            initialItems: COMMANDS.filter((c) => !c.illegal)
              .map(({ text, help }) => ({
                text,
                id: text,
                help,
              }))
              .concat([
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
            Object.entries(extensionAPI.settings.get("hot-keys"))
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
        const srcUid = (
          extensionAPI.settings.get("hot-keys") as Record<string, string>
        )[mapping];
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
      const dailyConfig = extensionAPI.settings.get("daily") as Record<
        string,
        string
      >;
      if (!!dailyConfig) {
        const time = dailyConfig["time"] || "00:00";
        const latest = dailyConfig["latest"] || "";
        const debug = process.env.NODE_ENV === "development";
        const [hours, minutes] = time.split(":").map((s) => Number(s));
        const today = new Date();
        const triggerTime = addMinutes(
          addHours(startOfDay(today), hours),
          minutes
        );
        if (isBefore(today, triggerTime)) {
          const ms = differenceInMilliseconds(triggerTime, today);
          window.setTimeout(runDaily, ms + 1000);
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
                const dailyWorkflowName = dailyConfig["workflow name"];
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
              window.setTimeout(runDaily, ms);
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
        renderStore({ parentUid, extensionAPI });
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
          renderPopover(span, extensionAPI);
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
            `{{(${b.textContent}):(?:42)?SmartBlock:(.*?)}}`
          );
          const text = getTextByBlockUid(parentUid);
          const match = regex.exec(text);
          if (match) {
            const {
              [1]: buttonContent = "",
              [2]: buttonText = "",
              index,
              [0]: full,
            } = match;
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
                variables["ButtonContent"] = buttonContent;

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
              img.src =
                "https://raw.githubusercontent.com/dvargas92495/roamjs-smartblocks/main/src/img/lego3blocks.png";
              img.width = 17;
              img.height = 14;
              img.style.marginRight = "7px";
              b.insertBefore(img, b.firstChild);
            }
          }
        }
      },
    });

    const highlightingObservers = !!highlighting
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
    addTokenDialogCommand();

    return {
      elements: [style],
      observers: [logoObserver, buttonLogoObserver, ...highlightingObservers],
      domListeners: [
        { type: "input", listener: documentInputListener, el: document },
        { type: "keydown", el: appRoot, listener: appRootKeydownListener },
      ],
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
