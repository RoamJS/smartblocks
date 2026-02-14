const HOTKEY_MODIFIERS = ["control", "alt", "shift", "meta"];

// Ordered by ergonomic preference: right-hand home row first (o, p, k, l),
// then surrounding keys, then left hand, then digits.
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
  throw new Error(
    "All hotkey combinations are in use. Remove an existing hotkey first."
  );
};

export default getNextAvailableHotKey;
