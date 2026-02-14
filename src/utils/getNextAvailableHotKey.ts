const HOTKEY_MODIFIERS = ["control", "alt", "shift", "meta"];
const HOTKEY_SUFFIXES = "opklijuyhgfdsawertqzxcvbnm1234567890".split("");

const getNextAvailableHotKey = (keys: Record<string, string>) => {
  for (const modifier of HOTKEY_MODIFIERS) {
    for (const suffix of HOTKEY_SUFFIXES) {
      const candidate = `${modifier}+${suffix}`;
      if (!keys[candidate]) {
        return candidate;
      }
    }
  }
  let fallback = 1;
  while (keys[`control+o+${fallback}`]) {
    fallback += 1;
  }
  return `control+o+${fallback}`;
};

export default getNextAvailableHotKey;
