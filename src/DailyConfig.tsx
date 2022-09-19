import { OnloadArgs } from "roamjs-components/types";
import { InputGroup, Label, Switch } from "@blueprintjs/core";
import { TimePicker } from "@blueprintjs/datetime";
import { useMemo, useState, } from "react";

const DailyConfig = (extensionAPI: OnloadArgs["extensionAPI"]) => () => {
  const config = useMemo(
    () =>
      extensionAPI.settings.get("daily") as Record<string, string> | undefined,
    []
  );
  const [disabled, setDisabled] = useState(!config);
  const [workflowName, setWorkflowName] = useState(config?.["workflow name"]);
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
  const lastRun = extensionAPI.settings.get("last-run");
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
            extensionAPI.settings.set("daily", {
              "workflow name": workflowName || "Daily",
              time: "00:00",
              latest: "",
              "last-run": "",
            });
            setDisabled(false);
          } else {
            extensionAPI.settings.set("daily", undefined);
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
            extensionAPI.settings.set("daily", {
              ...(extensionAPI.settings.get("daily") as Record<string, string>),
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
            extensionAPI.settings.set("daily", {
              ...(extensionAPI.settings.get("daily") as Record<string, string>),
              time: `${e.getHours()}:${e.getMinutes()}`,
            })
          }
          showArrowButtons
          disabled={disabled}
          className={"w-full user-select-none"}
        />
      </Label>
      <span>
        {extensionAPI.settings.get("last-run") &&
          `Last ran daily workflow on page ${lastRun}.`}
      </span>
    </div>
  );
};

export default DailyConfig;
