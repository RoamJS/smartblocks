import { InputGroup, Label, Switch } from "@blueprintjs/core";
import { TimePicker } from "@blueprintjs/datetime";
import React, { useMemo, useState } from "react";
import getDailyConfig from "../utils/getDailyConfig";
import saveDailyConfig from "../utils/saveDailyConfig";
import scheduleNextDailyRun from "../utils/scheduleNextDailyRun";

const DailyConfig = () => {
  const config = useMemo(getDailyConfig, []);
  const [disabled, setDisabled] = useState(!config);
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
  return (
    <div
      className="flex items-start gap-2 flex-col"
      style={{
        width: "100%",
        minWidth: 256,
      }}
    >
      <Switch
        defaultChecked={!!config}
        onChange={(e) => {
          if ((e.target as HTMLInputElement).checked) {
            saveDailyConfig({
              "workflow name": workflowName || "Daily",
              time: "00:00",
              "last-run": "",
            });
            scheduleNextDailyRun(true);
            setDisabled(false);
          } else {
            window.clearTimeout(getDailyConfig()["next-run-timeout"]);
            saveDailyConfig({ "workflow name": "" });
            setDisabled(true);
          }
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
      <span>{lastRun && `Last ran daily workflow on page ${lastRun}.`}</span>
    </div>
  );
};

export default DailyConfig;
