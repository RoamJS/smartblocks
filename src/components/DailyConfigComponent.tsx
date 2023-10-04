import {
  Checkbox,
  FormGroup,
  Icon,
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
  const config = useMemo(getDailyConfig, []);
  const [localConfig, setLocalConfig] = useState(config);
  const {
    enabled,
    device,
    time: setRunTime,
    "workflow name": workflowName,
    "last-run": lastRun,
    "next-run": configNextRun,
  } = localConfig;
  const [onlyOnThisDevice, setOnlyOnThisDevice] = useState(
    !!device && device === localStorageGet("device")
  );

  const defaultTime = useMemo(() => {
    const date = new Date();
    if (localConfig && setRunTime) {
      const [h, m] = setRunTime.split(":").map(Number);
      date.setHours(h);
      date.setMinutes(m);
    } else {
      date.setHours(0);
      date.setMinutes(0);
    }
    return date;
  }, [localConfig]);
  const [localTime, setLocalTime] = useState(defaultTime);
  const [now, setNow] = useState(new Date());
  const [isEditTime, setIsEditTime] = useState(false);
  const nextRun = useMemo(() => {
    if (!localConfig.enabled) return 0;
    return configNextRun - now.valueOf();
  }, [now, localConfig]);

  // migrate old config
  useEffect(() => {
    if (workflowName && !enabled) {
      saveDailyConfig({
        enabled: true,
      });
      setLocalConfig((prev) => ({ ...prev, enabled: true }));
    }
  }, [config]);

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
                      saveDailyConfig({
                        "workflow name": e.target.value,
                      });
                      setLocalConfig((prev) => ({
                        ...prev,
                        "workflow name": e.target.value,
                      }));
                      console.log(e.target.value);
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
                  <div className="flex items-center">
                    <TimePicker
                      defaultValue={defaultTime}
                      onChange={(e) => setLocalTime(e)}
                      showArrowButtons
                      disabled={!isEditTime}
                      className={
                        "user-select-none flex-1 text-center text-black"
                      }
                    />
                    <Icon
                      icon={isEditTime ? "tick" : "edit"}
                      onClick={async () => {
                        if (isEditTime) {
                          const newTime = `${localTime.getHours()}:${localTime.getMinutes()}`;
                          await saveDailyConfig({
                            time: newTime,
                          });
                          await scheduleNextDailyRun({ tomorrow: true });
                          setLocalConfig(getDailyConfig());
                          setIsEditTime(false);
                        } else {
                          setIsEditTime(true);
                        }
                      }}
                      className="cursor-pointer ml-2"
                      intent={isEditTime ? "success" : "none"}
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
                    {setRunTime
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
          onChange={(e) => {
            const enabled = (e.target as HTMLInputElement).checked;
            if (enabled) {
              saveDailyConfig({
                enabled: true,
                "workflow name": workflowName || "Daily",
              });
              setLocalConfig((prev) => ({
                ...prev,
                enabled: true,
                "workflow name": workflowName || "Daily",
              }));
              scheduleNextDailyRun({ tomorrow: true });
            } else {
              window.clearTimeout(getDailyConfig()["next-run-timeout"]);
              saveDailyConfig({ "workflow name": "", enabled: false });
              setLocalConfig((prev) => ({
                ...prev,
                "workflow name": "",
                enabled: false,
              }));
            }
          }}
        />
      </Tabs>
    </div>
  );
};

export default DailyConfig;
