import saveDailyConfig from "./saveDailyConfig";
import addSeconds from "date-fns/addSeconds";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";
import getDailyConfig from "./getDailyConfig";
import { getNodeEnv } from "roamjs-components/util/env";
import addDays from "date-fns/addDays";
import addHours from "date-fns/addHours";
import addMinutes from "date-fns/addMinutes";
import startOfDay from "date-fns/startOfDay";
import isBefore from "date-fns/isBefore";
import dateFnsFormat from "date-fns/format";
import renderToast from "roamjs-components/components/Toast";
import parseRoamDateUid from "roamjs-components/date/parseRoamDateUid";
import { getCleanCustomWorkflows, sbBomb } from "../core";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import createPage from "roamjs-components/writes/createPage";
import localStorageGet from "roamjs-components/util/localStorageGet";

const getTriggerTime = (day: Date) => {
  const time = getDailyConfig().time;
  const [hours, minutes] = time.split(":").map((s) => Number(s));
  return addMinutes(addHours(startOfDay(day), hours), minutes);
};

export const runDaily = async () => {
  const dailyConfig = getDailyConfig();
  const dailyWorkflowName = dailyConfig["workflow name"];
  if (!dailyWorkflowName) return;
  if (dailyConfig.device && dailyConfig.device !== localStorageGet("device"))
    return;

  const { ["last-run"]: lastRun } = dailyConfig;
  const debug = getNodeEnv() === "development";
  const today = new Date();
  const triggerTime = getTriggerTime(today);
  if (isBefore(today, triggerTime)) {
    scheduleNextDailyRun({ tomorrow: false });
    if (debug) {
      renderToast({
        id: "smartblocks-info",
        content: `Smartblocks: Still need to run the Smartblock later today at: ${dateFnsFormat(
          triggerTime,
          "hh:mm:ss a"
        )}`,
        intent: "primary",
      });
    }
    return;
  }
  if (debug) {
    renderToast({
      id: "smartblocks-info",
      content: `Smartblocks: It's after your trigger time, checking to see if we should run today...`,
      intent: "primary",
    });
  }
  const todayUid = window.roamAlphaAPI.util.dateToPageUid(today);

  const latestDate = parseRoamDateUid(lastRun);
  let saveLastRun = false;
  if (isBefore(startOfDay(latestDate), startOfDay(today))) {
    const availableWorkflows = getCleanCustomWorkflows();
    const srcUid = availableWorkflows.find(
      ({ name }) => name === dailyWorkflowName
    )?.uid;
    if (srcUid) {
      if (debug)
        renderToast({
          id: "smartblocks-info",
          content: `Smartblocks: About to run Daily SmartBlock: ${dailyWorkflowName}!`,
          intent: "primary",
        });

      if (!isLiveBlock(todayUid))
        await createPage({
          title: window.roamAlphaAPI.util.dateToPageTitle(today),
        });
      await sbBomb({
        srcUid,
        target: { uid: todayUid, isParent: true },
        fromDaily: true,
      });
      saveLastRun = true;
    } else {
      renderToast({
        id: "smartblocks-error",
        content: `RoamJS Error: Daily SmartBlocks enabled, but couldn't find SmartBlock Workflow named "${dailyWorkflowName}"`,
        intent: "danger",
      });
    }
  } else if (debug) {
    renderToast({
      id: "smartblocks-info",
      content: `Smartblocks: No need to run daily workflow on ${todayUid}. Last run on ${lastRun}.`,
      intent: "primary",
    });
  }
  scheduleNextDailyRun({ saveLastRun: true, tomorrow: true });
};

const scheduleNextDailyRun = (
  args: { tomorrow?: boolean; saveLastRun?: boolean } = {}
) => {
  const today = new Date();
  const triggerDay = args.tomorrow ? addDays(today, 1) : today;
  const triggerDate = addSeconds(getTriggerTime(triggerDay), 1);
  const ms = differenceInMilliseconds(triggerDate, today);
  const timeout = window.setTimeout(() => {
    runDaily();
  }, ms);
  saveDailyConfig({
    "next-run": triggerDate.valueOf(),
    "next-run-timeout": timeout,
    ...(args.saveLastRun
      ? { "last-run": window.roamAlphaAPI.util.dateToPageUid(today) }
      : {}),
  });
};

export default scheduleNextDailyRun;
