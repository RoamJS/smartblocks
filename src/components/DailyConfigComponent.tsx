import { Checkbox, InputGroup, Label, Switch } from "@blueprintjs/core";
import { TimePicker } from "@blueprintjs/datetime";
import React, { useMemo, useState, useEffect } from "react";
import getDailyConfig from "../utils/getDailyConfig";
import saveDailyConfig from "../utils/saveDailyConfig";
import scheduleNextDailyRun from "../utils/scheduleNextDailyRun";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";
import nanoid from "nanoid";

const DailyConfig = () => {
  const config = useMemo(getDailyConfig, []);
  const [disabled, setDisabled] = useState(!config.enabled);
  const [onlyOnThisDevice, setOnlyOnThisDevice] = useState(
    !!config.device && config.device === localStorageGet("device")
  );
  const [workflowName, setWorkflowName] = useState(config["workflow name"]);
  const defaultTime = useMemo(() => {
    const date = new Date();
    if (config && config["time"]) {
      const [h, m] = config["time"].split(":").map(Number);
      date.setHours(h);
      date.setMinutes(m);
    } else {
      date.setHours(0);
      date.setMinutes(0);
    }
    return date;
  }, [config]);
  const lastRun = config?.["last-run"];
  const [now, setNow] = useState(new Date());
  const nextRun = useMemo(() => {
    if (!config.enabled) return 0;
    return config["next-run"] - now.valueOf();
  }, [now, config]);

  // migrate old config
  useEffect(() => {
    if (config["workflow name"] && !config["enabled"]) {
      saveDailyConfig({
        enabled: true,
      });
      setDisabled(false);
    }
  }, [config]);
  useEffect(() => {
    const int = window.setInterval(() => {
      setNow(new Date());
    }, 500);
    return () => {
      window.clearInterval(int);
    };
  }, [setNow]);
  return (
    <div
      className="flex items-start gap-2 flex-col"
      style={{
        width: "100%",
        minWidth: 256,
      }}
    >
      <Switch
        defaultChecked={config.enabled}
        onChange={(e) => {
          const enabled = (e.target as HTMLInputElement).checked;
          if (enabled) {
            saveDailyConfig({
              "workflow name": workflowName || "Daily",
            });
            scheduleNextDailyRun({ tomorrow: true });
          } else {
            window.clearTimeout(getDailyConfig()["next-run-timeout"]);
            saveDailyConfig({ "workflow name": "" });
            setWorkflowName("");
          }
          setDisabled(!enabled);
        }}
        label={disabled ? "Disabled" : "Enabled"}
      />
      <Label>
        Workflow Name
        <InputGroup
          value={workflowName}
          onChange={(e) => {
            saveDailyConfig({
              "workflow name": e.target.value,
            });
            setWorkflowName(e.target.value);
          }}
          disabled={disabled}
          placeholder={"Daily"}
          className={"w-full"}
        />
      </Label>
      <Label>
        Time To Run
        <TimePicker
          defaultValue={defaultTime}
          onChange={(e) =>
            saveDailyConfig({ time: `${e.getHours()}:${e.getMinutes()}` })
          }
          showArrowButtons
          disabled={disabled}
          className={"w-full user-select-none"}
        />
      </Label>
      <span>
        {lastRun &&
          lastRun !== "01-01-1970" &&
          `Last ran daily workflow on page ${lastRun}.`}
      </span>
      <span>
        {!!nextRun &&
          !disabled &&
          `Next run is in ${Math.floor(
            nextRun / (60 * 60 * 1000)
          )} hours, ${Math.floor(
            (nextRun % (60 * 60 * 1000)) / (60 * 1000)
          )} minutes, ${Math.floor((nextRun % (60 * 1000)) / 1000)} seconds.`}
      </span>
      <Checkbox
        defaultChecked={onlyOnThisDevice}
        onChange={(e) => {
          const enabled = (e.target as HTMLInputElement).checked;
          if (enabled) {
            const deviceId = localStorageGet("device") && nanoid();
            saveDailyConfig({
              device: deviceId,
            });
            localStorageSet("device", deviceId);
          } else {
            saveDailyConfig({ device: "" });
          }
          setOnlyOnThisDevice(enabled);
        }}
        label={"Only run on this device"}
        disabled={disabled}
      />
    </div>
  );
};

export default DailyConfig;
