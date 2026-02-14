import runExtension from "roamjs-components/util/runExtension";
import getBlockUidsAndTextsReferencingPage from "roamjs-components/queries/getBlockUidsAndTextsReferencingPage";
import addStyle from "roamjs-components/dom/addStyle";
import createBlock from "roamjs-components/writes/createBlock";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import getUids from "roamjs-components/dom/getUids";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import createBlockObserver from "roamjs-components/dom/createBlockObserver";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import { render as renderCursorMenu } from "roamjs-components/components/CursorMenu";
import { render as renderToast } from "roamjs-components/components/Toast";
import { render } from "./SmartblocksMenu";
import { render as renderPopover } from "./SmartblockPopover";
import { render as renderBulk } from "./BulkTrigger";
import {
  COMMANDS,
  getCleanCustomWorkflows,
  getCustomWorkflows,
  getVisibleCustomWorkflows,
  handlerByCommand,
  proccessBlockText,
  proccessBlockWithSmartness,
  sbBomb,
  smartBlocksContext,
  resetContext,
  processChildren,
} from "./utils/core";
import { Intent } from "@blueprintjs/core";
import HotKeyPanel from "./HotKeyPanel";
import XRegExp from "xregexp";
import { PullBlock } from "roamjs-components/types";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import extractRef from "roamjs-components/util/extractRef";
import getDailyConfig from "./utils/getDailyConfig";
import saveDailyConfig from "./utils/saveDailyConfig";
import DailyConfigComponent from "./components/DailyConfigComponent";
import { runDaily } from "./utils/scheduleNextDailyRun";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import { zCommandOutput } from "./utils/zodTypes";
import { IconNames } from "@blueprintjs/icons";
import parseSmartBlockButton from "./utils/parseSmartBlockButton";

const getLegacy42Setting = (name: string) => {
  const settings = Object.fromEntries(
    getBlockUidsAndTextsReferencingPage("42Setting").map(({ text, uid }) => {
      const [_, name, value] = text.trim().split(/\s/);
      return [name, { value, uid }];
    })
  );
  return (settings[name]?.value || "").replace(/"/g, "").trim();
};

const COMMAND_ENTRY_REGEX = /<%$/;
const COLORS = ["darkblue", "darkred", "darkgreen", "darkgoldenrod"];
export default runExtension(async ({ extensionAPI }) => {
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
}

.roamjs-hotkey-dropdown .bp3-menu {
  max-height: 300px;
  overflow-y: auto;
}
.rm-settings-tabs .roamjs-daily-config-tabs .bp3-tab-list {
  padding: 2px;
  background: none;
}
.rm-settings-tabs .roamjs-daily-config-tabs .bp3-timepicker.bp3-disabled .bp3-timepicker-input{
  color: #4b5563;
}`);

  let commandPaletteEnabled = false;
  let commandPaletteOptIn = !!extensionAPI.settings.get(
    "command-palette-opt-in"
  );

  const removeCommandPaletteCommands = () => {
    getCleanCustomWorkflows(getVisibleCustomWorkflows()).forEach((wf) => {
      window.roamAlphaAPI.ui.commandPalette.removeCommand({
        label: `Trigger SmartBlock: ${wf.name}`,
      });
    });
  };

  const addCommandPaletteCommands = () => {
    const eligibleWorkflows = getVisibleCustomWorkflows().filter((wf) =>
      commandPaletteOptIn ? wf.commandPaletteEligible : true
    );
    getCleanCustomWorkflows(eligibleWorkflows).forEach((wf) => {
      window.roamAlphaAPI.ui.commandPalette.addCommand({
        label: `Trigger SmartBlock: ${wf.name}`,
        callback: () => {
          const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
          const targetUid = focusedBlock?.["block-uid"];
          const windowId = focusedBlock?.["window-id"];
          // Because the command palette does a blur event on close,
          // we want a slight delay so that we could keep focus
          window.setTimeout(() => {
            if (targetUid) {
              sbBomb({
                srcUid: wf.uid,
                target: {
                  uid: targetUid,
                  isParent: false,
                  start: getTextByBlockUid(targetUid).length,
                  windowId,
                },
                mutableCursor: true,
              });
            } else {
              window.roamAlphaAPI.ui.mainWindow
                .getOpenPageOrBlockUid()
                .then((uid) =>
                  sbBomb({
                    srcUid: wf.uid,
                    target: {
                      uid:
                        uid ||
                        window.roamAlphaAPI.util.dateToPageUid(new Date()),
                      isParent: true,
                      windowId,
                    },
                    mutableCursor: true,
                  })
                );
            }
          }, 500);
        },
      });
    });
  };

  const syncCommandPaletteCommands = () => {
    removeCommandPaletteCommands();
    if (commandPaletteEnabled) {
      addCommandPaletteCommands();
    }
  };

  const toggleCommandPalette = (flag: boolean) => {
    commandPaletteEnabled = flag;
    syncCommandPaletteCommands();
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
  let hideButtonIcon = extensionAPI.settings.get("hide-button-icon") as boolean;
  let highlighting = extensionAPI.settings.get("highlighting") as boolean;

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
        id: "command-palette-opt-in",
        name: "Command Palette Opt-In",
        description:
          "If enabled, workflows must include <%CMD%> in their title to appear in the command palette",
        action: {
          type: "switch",
          onChange: (e) => {
            commandPaletteOptIn = (e.target as HTMLInputElement).checked;
            syncCommandPaletteCommands();
          },
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
        id: "daily",
        name: "Daily",
        description:
          "Enable to trigger a given workflow at a certain time on each day",
        action: {
          type: "reactComponent",
          component: DailyConfigComponent,
        },
      },
    ],
  });
  commandPaletteEnabled = !!extensionAPI.settings.get("command-palette");
  syncCommandPaletteCommands();
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
        handler: async (...args) => {
          try {
            const result = await handler({
              ...smartBlocksContext,
              proccessBlockText,
              processBlock: proccessBlockWithSmartness,
            })(...args);
            return zCommandOutput.parse(result);
          } catch (e) {
            console.error(e);
            return `Custom Command ${command} Failed: ${(e as Error).message}`;
          }
        },
        delayArgs,
      };
      customCommands.push({ text: command, help });
      return () => {
        customCommands.splice(
          customCommands.findIndex((c) => c.text === command),
          1
        );
      };
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
      targetName = "",
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
          resetContext({
            targetUid: undefined,
            variables,
            triggerUid: undefined,
          });
          const childNodes = getFullTreeByParentUid(srcUid).children;
          return processChildren({ nodes: childNodes });
        }
      }
      return new Promise((resolve) =>
        setTimeout(
          () =>
            sbBomb({
              srcUid,
              target: {
                uid: targetUid,
                isParent: !!(targetName || getPageTitleByPageUid(targetUid)),
              },
              variables,
            }).then(resolve),
          10
        )
      );
    },
  };

  let menuLoaded = false;

  const documentInputListener = (e: Event) => {
    const target = e.target as HTMLElement;
    if (
      !menuLoaded &&
      target.tagName === "TEXTAREA" &&
      target.classList.contains("rm-block-input")
    ) {
      const textarea = target as HTMLTextAreaElement;
      const location = window.roamAlphaAPI.ui.getFocusedBlock();
      if (!location) return;
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
            .filter((c) => !c.hidden)
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
              {
                text: "CMD",
                id: "CMD",
                help: "Workflow modifier that opts this workflow into appearing in the command palette when Command Palette Opt-In is enabled",
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
          Object.entries(
            (extensionAPI.settings.get("hot-keys") as object) || {}
          )
            .map(([k, uid]) => [k.split("+"), uid] as const)
            .filter(([k]) => k.every((l) => l.length === 1))
            .find(([k]) => new RegExp(`${k.join("")}$`).test(valueToCursor)) ||
          [];
        if (k && srcUid) {
          const { blockUid, windowId } = getUids(textarea);
          sbBomb({
            srcUid,
            target: {
              uid: blockUid,
              start: textarea.selectionStart - k.length,
              end: textarea.selectionStart,
              windowId,
            },
            mutableCursor: true,
          });
        }
      }
    }
  };
  document.addEventListener("input", documentInputListener);

  const globalHotkeyListener = async (_e: Event) => {
    const e = _e as KeyboardEvent;
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
      )?.[mapping];
      if (srcUid) {
        e.preventDefault();
        e.stopPropagation();
        const focusedBlock = window.roamAlphaAPI.ui.getFocusedBlock();
        const focusedUid = focusedBlock?.["block-uid"];
        const windowId = focusedBlock?.["window-id"];
        const target =
          focusedUid ||
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
            windowId,
          },
          mutableCursor: true,
        }).then((n) => {
          if (n === 0 && !focusedUid) deleteBlock(target);
        });
      }
    }
  };
  document.addEventListener("keydown", globalHotkeyListener);
  // We want to delay this so that remote changes could be applied first from multiple devices,
  // namely daily config settings.
  setTimeout(runDaily, 1000 * 10);

  const RUN_MULTIPLE_SMARTBLOCKS_COMMAND_LABEL = "Run Multiple SmartBlocks";
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: RUN_MULTIPLE_SMARTBLOCKS_COMMAND_LABEL,
    callback: () => {
      const parentUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      renderBulk({
        initialLocations: parentUid
          ? window.roamAlphaAPI.data.fast
              .q(
                `[:find (pull ?p [:node/title]) :where [?b :block/uid "${parentUid}"] [?c :block/parents ?b] [?c :block/refs ?p]]`
              )
              .map((a) => (a as [PullBlock])[0]?.[":node/title"])
              .filter((a): a is string => !!a)
          : [],
      });
    },
  });

  const REFRESH_SMARTBLOCKS_COMMAND_LABEL =
    "Refresh SmartBlocks Command Palette";
  window.roamAlphaAPI.ui.commandPalette.addCommand({
    label: REFRESH_SMARTBLOCKS_COMMAND_LABEL,
    callback: () => {
      syncCommandPaletteCommands();
      renderToast({
        id: "smartblocks-command-palette-refresh",
        intent: Intent.SUCCESS,
        content: "Command palette workflows refreshed",
        timeout: 2000,
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

  const registerElAsSmartBlockTrigger = ({
    textContent,
    text,
    el,
    parentUid,
    hideIcon,
  }: {
    textContent: string;
    text: string;
    el: HTMLElement;
    parentUid: string;
    hideIcon?: boolean;
  }) => {
    // We include textcontent here bc there could be multiple smartblocks in a block
    const label = textContent.trim();
    const parsed = parseSmartBlockButton(label, text);
    if (parsed) {
      const { index, full, buttonContent, workflowName, variables } = parsed;
      const clickListener = () => {
        const workflows = getCustomWorkflows();
        const availableWorkflows = getCleanCustomWorkflows(workflows);
        const { uid: srcUid } =
          availableWorkflows.find(({ name }) => name === workflowName) || {};

        if (!srcUid) {
          createBlock({
            node: {
              text: "Could not find custom workflow with the name:",
              children: [{ text: workflowName }],
            },
            parentUid,
          });
        } else {
          const keepButton =
            /false/i.test(variables["RemoveButton"]) ||
            /false/i.test(variables["42RemoveButton"]);
          const clearBlock = /true/i.test(variables["Clear"]);
          const applyToSibling = variables["Sibling"];
          const explicitTargetUid = extractRef(variables["TargetRef"]);
          const order =
            variables["Order"] === "last"
              ? "last"
              : !variables["Order"]
              ? 0
              : !isNaN(Number(variables["Order"]))
              ? Number(variables["Order"])
              : 0;

          const props = {
            srcUid,
            variables,
            mutableCursor: !(
              workflows.find((w) => w.uid === srcUid)?.name || ""
            ).includes("<%NOCURSOR%>"),
            triggerUid: parentUid,
          };

          if (applyToSibling) {
            const sbParentTree = getShallowTreeByParentUid(
              getParentUidByBlockUid(parentUid)
            );
            const siblingIndex =
              sbParentTree.findIndex((obj) => obj.uid === parentUid) +
              (applyToSibling === "previous" ? -1 : 1);
            const siblingUid = sbParentTree[siblingIndex]?.uid;
            const siblingText = getTextByBlockUid(siblingUid);

            updateBlock({
              uid: parentUid,
              text:
                clearBlock && keepButton
                  ? full
                  : clearBlock
                  ? ""
                  : keepButton
                  ? text
                  : `${text.substring(0, index)}${text.substring(
                      index + full.length
                    )}`,
            });
            !!siblingUid
              ? updateBlock({
                  uid: siblingUid,
                }).then(() =>
                  sbBomb({
                    ...props,
                    target: {
                      uid: siblingUid,
                      start: siblingText.length,
                      end: siblingText.length,
                    },
                  })
                )
              : createBlock({
                  node: { text: "" },
                  parentUid: getParentUidByBlockUid(parentUid),
                  order: siblingIndex === -1 ? 0 : siblingIndex,
                }).then((targetUid) =>
                  sbBomb({
                    ...props,
                    target: {
                      uid: targetUid,
                      start: 0,
                      end: 0,
                    },
                  })
                );
          } else if (keepButton) {
            explicitTargetUid
              ? sbBomb({
                  ...props,
                  target: {
                    uid: explicitTargetUid,
                    start: 0,
                    end: 0,
                    isParent: true,
                  },
                })
              : createBlock({
                  node: { text: "" },
                  parentUid,
                  order,
                }).then((targetUid) =>
                  sbBomb({
                    ...props,
                    target: {
                      uid: targetUid,
                      start: 0,
                      end: 0,
                    },
                  }).then((n) => {
                    if (n === 0) deleteBlock(targetUid);
                  })
                ),
              clearBlock
                ? updateBlock({
                    uid: parentUid,
                    text: full,
                  })
                : "";
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
      };

      el.addEventListener("click", clickListener);

      const iconSetting = variables["Icon"]?.toLowerCase();

      const shouldHideIcon =
        hideButtonIcon ||
        hideIcon ||
        iconSetting === "false" ||
        iconSetting === "none";

      const isValidBlueprintIcon = (
        name: string
      ): name is (typeof IconNames)[keyof typeof IconNames] =>
        Object.values(IconNames).includes(name as any);

      if (!shouldHideIcon) {
        let iconElement: HTMLElement | null = null;

        const hasTextContent = el.textContent && el.textContent.trim() !== "";

        if (iconSetting && isValidBlueprintIcon(iconSetting)) {
          iconElement = document.createElement("span");
          iconElement.className = `bp3-icon bp3-icon-${iconSetting}`;
          if (hasTextContent) iconElement.style.margin = "0 7px 0 0";
          else iconElement.style.margin = "0";
        } else {
          // Default lego icon
          const img = new Image();
          img.src =
            "https://raw.githubusercontent.com/RoamJS/smartblocks/main/src/img/lego3blocks.png";
          if (hasTextContent) img.style.margin = "0 7px 0 0";
          else img.style.margin = "0";
          img.width = 17;
          img.height = 14;
          iconElement = img;
        }

        el.insertBefore(iconElement, el.firstChild);
        return () => {
          iconElement?.remove();
          el.removeEventListener("click", clickListener);
        };
      }

      return () => {
        el.removeEventListener("click", clickListener);
      };
    }
    return () => {};
  };

  const unloads = new Set<() => void>();
  const buttonLogoObserver = createHTMLObserver({
    className: "bp3-button bp3-small dont-focus-block",
    tag: "BUTTON",
    callback: (b) => {
      const parentUid = getBlockUidFromTarget(b);
      if (parentUid && !b.hasAttribute("data-roamjs-smartblock-button")) {
        const text = getTextByBlockUid(parentUid);
        b.setAttribute("data-roamjs-smartblock-button", "true");

        // We include textcontent here bc there could be multiple smartblocks in a block
        // TODO: if multiple smartblocks have the same textContent, we need to distinguish them
        const unload = registerElAsSmartBlockTrigger({
          textContent: b.textContent || "",
          text,
          el: b,
          parentUid,
        });
        unloads.add(() => {
          b.removeAttribute("data-roamjs-smartblock-button");
          unload();
        });
      }
    },
  });

  const todoObserver = createHTMLObserver({
    tag: "LABEL",
    className: "check-container",
    callback: (l) => {
      if (l.hasAttribute("data-roamjs-smartblock-button")) return;
      l.setAttribute("data-roamjs-smartblock-button", "true");
      const inputTarget = l.querySelector("input");
      if (inputTarget?.type !== "checkbox") return;
      const blockUid = getBlockUidFromTarget(inputTarget);
      const text = getTextByBlockUid(blockUid);
      if (!/^{{\[\[TODO\]\]:[^}]+}}/.test(text)) return;
      // We include textcontent here bc there could be multiple smartblocks in a block
      const unload = registerElAsSmartBlockTrigger({
        textContent: "\\[\\[TODO\\]\\]",
        text,
        el: inputTarget,
        parentUid: blockUid,
      });
      unloads.add(() => {
        l.removeAttribute("data-roamjs-smartblock-button");
        unload();
      });
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
          (t) => !t.parentElement?.closest(".CodeMirror")
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
            const { nodeValue, parentElement } = t;
            if (!nodeValue || !parentElement) return;
            matches
              .filter(
                (m) =>
                  m.end > totalCount && m.start < totalCount + nodeValue.length
              )
              .map((m) => {
                const overlap = nodeValue.substring(
                  Math.max(0, m.start - totalCount),
                  Math.min(nodeValue.length, m.end - totalCount)
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
              .filter((s): s is HTMLSpanElement => !!s)
              .forEach((s) => parentElement.insertBefore(s, t));
            totalCount += nodeValue.length;
            t.nodeValue = "";
          });
        }
      })
    : [];

  return {
    elements: [style],
    observers: [
      logoObserver,
      buttonLogoObserver,
      todoObserver,
      ...highlightingObservers,
    ],
    domListeners: [
      { type: "input", listener: documentInputListener, el: document },
      { type: "keydown", listener: globalHotkeyListener, el: document },
    ],
    commands: [
      RUN_MULTIPLE_SMARTBLOCKS_COMMAND_LABEL,
      REFRESH_SMARTBLOCKS_COMMAND_LABEL,
    ],
    unload: () => {
      unloads.forEach((u) => u());
      window.clearTimeout(getDailyConfig()["next-run-timeout"]);
      saveDailyConfig({ "next-run-timeout": 0 });
    },
  };
});
