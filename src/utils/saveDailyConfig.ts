import getExtensionApi from "roamjs-components/util/extensionApiContext";
import getDailyConfig, { DailyConfig } from "./getDailyConfig";

const saveDailyConfig = (config: Partial<DailyConfig>) => {
  const currentConfig = getDailyConfig();
  getExtensionApi().settings.set("daily", {
    ...currentConfig,
    ...config,
  });
};

export default saveDailyConfig;
