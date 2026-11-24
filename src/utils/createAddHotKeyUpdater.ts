import getNextAvailableHotKey from "./getNextAvailableHotKey";

export const createAddHotKeyUpdater = ({
  randomWorkflowUid,
  setHotKeys,
}: {
  randomWorkflowUid: string;
  setHotKeys: (keys: Record<string, string>) => void;
}) =>
  (currentKeys: Record<string, string>) => {
    try {
      const nextHotkey = getNextAvailableHotKey(currentKeys);
      const newKeys = Object.fromEntries(
        Object.entries(currentKeys).concat([[nextHotkey, randomWorkflowUid]])
      );
      setHotKeys(newKeys);
      return newKeys;
    } catch {
      return currentKeys;
    }
  };
