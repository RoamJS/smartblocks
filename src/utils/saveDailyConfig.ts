import getExtensionApi from "roamjs-components/util/extensionApiContext";
import getDailyConfig, { DailyConfig } from "./getDailyConfig";

const saveDailyConfig = async (config: Partial<DailyConfig>) => {
  const currentConfig = getDailyConfig();
  return getExtensionApi().settings.set("daily", {
    ...currentConfig,
    ...config,
  });
};

export default saveDailyConfig;
