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
import lego from "./img/lego3blocks.png";
import {
  CommandHandler,
  getCustomWorkflows,
  handlerByCommand,
  sbBomb,
} from "./smartblocks";

addStyle(`.rm-page-ref--tag[data-tag="42SmartBlock"]:before, .rm-page-ref--tag[data-tag="SmartBlock"]:before {
  display:inline-block;
  height:14px;
  width:24px;
  content: "";
  background:url(${lego}) no-repeat 0 0;
  background-size: auto 14px;
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

.roamjs-smartblocks-store-item:hover {
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
});
