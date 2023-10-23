import React, { useMemo, useState, useEffect } from "react";
import {
  Checkbox,
  FormGroup,
  InputGroup,
  Label,
  Switch,
  Tab,
  Tabs,
  Text,
} from "@blueprintjs/core";
import { TimePicker } from "@blueprintjs/datetime";
import getDailyConfig from "../utils/getDailyConfig";
import saveDailyConfig from "../utils/saveDailyConfig";
import scheduleNextDailyRun from "../utils/scheduleNextDailyRun";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";
import nanoid from "nanoid";

const DailyConfig = () => {
  const initialConfig = useMemo(getDailyConfig, []);
  const [localConfig, setLocalConfig] = useState(initialConfig);
  const setConfig = async (newConfig: { [key: string]: any }) => {
    setLocalConfig((prev) => ({ ...prev, ...newConfig }));
    await saveDailyConfig(newConfig);
  };
  const {
    enabled,
    device,
    time: timeToRun,
    "workflow name": workflowName,
    "last-run": lastRun,
    "next-run": configNextRun,
  } = localConfig;

  const currentDevice = useMemo(() => localStorageGet("device"), []);
  const timePicker = useMemo(() => {
    const date = new Date();
    if (localConfig && timeToRun) {
      const [h, m] = timeToRun.split(":").map(Number);
      date.setHours(h);
      date.setMinutes(m);
    } else {
      date.setHours(0);
      date.setMinutes(0);
    }
    return date;
  }, [localConfig]);
  const [now, setNow] = useState(new Date());
  const nextRun = useMemo(() => {
    if (!localConfig.enabled) return 0;
    return configNextRun - now.valueOf();
  }, [now, localConfig]);

  // migrate old config
  useEffect(() => {
    if (workflowName && !enabled) {
      setConfig({ enabled: true });
    }
  }, [initialConfig]);

  // Set up an interval to periodically update the current time
  useEffect(() => {
    const int = window.setInterval(() => {
      setNow(new Date());
    }, 500);
    return () => {
      window.clearInterval(int);
    };
  }, [setNow]);

  return (
    <div>
      <Tabs className="roamjs-daily-config-tabs" defaultSelectedTabId="dct">
        {enabled && (
          <Tab
            className="text-white"
            id="dct"
            title="Daily Config"
            panel={
              <div className="flex items-start gap-2 flex-col">
                <FormGroup
                  label="Workflow Name"
                  labelFor="roamjs-workflow-name"
                  className="my-4"
                >
                  <InputGroup
                    id="roamjs-workflow-name"
                    value={workflowName}
                    onChange={(e) => {
                      setConfig({ "workflow name": e.target.value });
                    }}
                    style={{ minWidth: "initial" }}
                    placeholder={"Enter workflow name"}
                  />
                </FormGroup>

                <FormGroup
                  label="Time To Run"
                  labelFor="roamjs-time-picker"
                  className="mb-4 flex"
                  style={{ alignItems: "center" }}
                  inline={true}
                >
                  <div className="flex items-center">
                    <TimePicker
                      value={timePicker}
                      onChange={async (e) => {
                        const newTime = `${e.getHours()}:${e.getMinutes()}`;
                        await setConfig({ time: newTime });
                        await scheduleNextDailyRun({ tomorrow: true });
                        setLocalConfig(getDailyConfig());
                      }}
                      showArrowButtons
                      className={"user-select-none flex-1 text-center"}
                    />
                  </div>
                </FormGroup>

                <FormGroup
                  label="Only Run On This Device"
                  labelFor="roam-js-only-on-this-device"
                  inline={true}
                >
                  <Checkbox
                    id="roam-js-only-on-this-device"
                    defaultChecked={!!device && device === currentDevice}
                    onChange={(e) => {
                      const enabled = (e.target as HTMLInputElement).checked;
                      if (enabled) {
                        const deviceId = currentDevice || nanoid();
                        setConfig({ device: deviceId });
                        localStorageSet("device", deviceId);
                      } else {
                        setConfig({ device: "" });
                      }
                    }}
                    disabled={!enabled}
                  />
                </FormGroup>
              </div>
            }
            disabled={!enabled}
          />
        )}
        {enabled && (
          <Tab
            className="text-white"
            id="rdt"
            title="Run Details"
            panel={
              <div className="flex items-start gap-2 flex-col">
                <Label>
                  Last Run
                  <Text style={{ color: "#8A9BA8" }}>
                    {lastRun && lastRun !== "01-01-1970"
                      ? `Last ran on page ${lastRun}`
                      : "Last run data not available"}
                  </Text>
                </Label>
                <Label>
                  Next Run
                  <Text style={{ color: "#8A9BA8" }}>
                    {!!nextRun
                      ? `${Math.floor(
                          nextRun / (60 * 60 * 1000)
                        )} hours, ${Math.floor(
                          (nextRun % (60 * 60 * 1000)) / (60 * 1000)
                        )} minutes, ${Math.floor(
                          (nextRun % (60 * 1000)) / 1000
                        )} seconds`
                      : "Next run data not available"}
                  </Text>
                </Label>
                <Label>
                  Current Date and Time
                  <Text style={{ color: "#8A9BA8" }}>
                    {new Date().toLocaleString()}
                  </Text>
                </Label>
                <Label>
                  Next Run Scheduled At
                  <Text style={{ color: "#8A9BA8", maxWidth: "200px" }}>
                    {new Date(configNextRun).toLocaleString()}
                  </Text>
                </Label>
                <Label>
                  Set "Time To Run"
                  <Text style={{ color: "#8A9BA8", maxWidth: "200px" }}>
                    {timeToRun
                      .split(":")
                      .map((val, i) => (i === 0 ? `${val} HR` : `${val} M`))
                      .join(" ")}
                  </Text>
                </Label>
              </div>
            }
          />
        )}
        <Tabs.Expander />
        <Switch
          large={true}
          className="w-full text-right"
          checked={enabled}
          onChange={async (e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            if (enabled) {
              await setConfig({
                enabled: true,
                "workflow name": workflowName || "Daily",
              });
              scheduleNextDailyRun({ tomorrow: true });
            } else {
              window.clearTimeout(getDailyConfig()["next-run-timeout"]);
              setConfig({
                "workflow name": "",
                enabled: false,
              });
            }
          }}
        />
      </Tabs>
    </div>
  );
};

export default DailyConfig;
