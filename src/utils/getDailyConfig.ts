import { z } from "zod";
import getExtensionApi from "roamjs-components/util/extensionApiContext";

const zDailyConfig = z
  .object({
    time: z.string().optional().default("00:00"),
    "last-run": z.string().optional().default("01-01-1970"),
    "workflow name": z.string().optional().default(""),
    "next-run": z.number().optional().default(0),
    "next-run-timeout": z.number().optional().default(0),
    enabled: z.boolean().optional().default(false),
  })
  .or(
    z.null().transform(() => ({
      time: "00:00",
      "last-run": "01-01-1970",
      "workflow name": "",
      "next-run": 0,
      "next-run-timeout": 0,
      enabled: false,
    }))
  )
  .optional()
  .default({});

export type DailyConfig = z.infer<typeof zDailyConfig>;

const getDailyConfig = () => {
  return zDailyConfig.parse(getExtensionApi().settings.get("daily"));
};

export default getDailyConfig;
