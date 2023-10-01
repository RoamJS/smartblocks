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
import React, { useMemo, useState, useEffect } from "react";
import getDailyConfig from "../utils/getDailyConfig";
import saveDailyConfig from "../utils/saveDailyConfig";
import scheduleNextDailyRun from "../utils/scheduleNextDailyRun";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageSet from "roamjs-components/util/localStorageSet";
import nanoid from "nanoid";

const DailyConfig = () => {
  // TODO refresh config so debug panel shows up to date info
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
    <div>
      <Tabs className="roamjs-daily-config-tabs">
        {!disabled && (
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
                      saveDailyConfig({
                        "workflow name": e.target.value,
                      });
                      setWorkflowName(e.target.value);
                    }}
                    style={{ minWidth: "initial" }}
                    placeholder={"Daily"}
                  />
                </FormGroup>

                <FormGroup
                  label="Time To Run"
                  labelFor="roamjs-time-picker"
                  className="mb-4 flex"
                  style={{ alignItems: "center" }}
                  inline={true}
                >
                  <TimePicker
                    defaultValue={defaultTime}
                    onChange={(e) =>
                      saveDailyConfig({
                        time: `${e.getHours()}:${e.getMinutes()}`,
                      })
                    }
                    showArrowButtons
                    disabled={disabled}
                    className={"w-full user-select-none flex-1 text-center"}
                  />
                </FormGroup>

                <FormGroup
                  label="Only Run On This Device"
                  labelFor="roam-js-only-on-this-device"
                  inline={true}
                >
                  <Checkbox
                    id="roam-js-only-on-this-device"
                    defaultChecked={onlyOnThisDevice}
                    onChange={(e) => {
                      const enabled = (e.target as HTMLInputElement).checked;
                      if (enabled) {
                        const deviceId = localStorageGet("device") || nanoid();
                        saveDailyConfig({
                          device: deviceId,
                        });
                        localStorageSet("device", deviceId);
                      } else {
                        saveDailyConfig({ device: "" });
                      }
                      setOnlyOnThisDevice(enabled);
                    }}
                    disabled={disabled}
                  />
                </FormGroup>
              </div>
            }
            disabled={disabled}
          />
        )}
        {!disabled && (
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
                      ? `Last ran daily workflow on page ${lastRun}.`
                      : "Last run data not available"}
                  </Text>
                </Label>
                <Label>
                  Next Run
                  <Text style={{ color: "#8A9BA8" }}>
                    {!!nextRun
                      ? `In ${Math.floor(
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
                    {/* TODO display this */}
                    {/* {new Date(config["next-run"])} */}
                  </Text>
                </Label>
                <Label>
                  Next Run Timeout
                  <Text style={{ color: "#8A9BA8", maxWidth: "200px" }}>
                    {config["next-run-timeout"]}
                  </Text>
                </Label>
                <Label>
                  Set "Time To Run"
                  <Text style={{ color: "#8A9BA8", maxWidth: "200px" }}>
                    {config["time"]}
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
        />
      </Tabs>
    </div>
  );
};

export default DailyConfig;
