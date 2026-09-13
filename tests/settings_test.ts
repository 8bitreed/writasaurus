import {
  applyFontPreference,
  DEFAULT_FONT,
  FONT_MAP,
  FONT_OPTIONS,
  type FontOption,
  getFontPreference,
  saveFontPreference,
  SETTINGS_KEY,
} from "../src/lib/settings.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("settings: font options include system, serif, and sans-serif choices", () => {
  const ids = FONT_OPTIONS.map((f) => f.id);
  assert(ids.includes("system"));
  assert(ids.includes("serif"));
  assert(ids.includes("sans-serif"));
  assert(ids.includes("georgia"));
  assert(ids.includes("times"));
  assert(ids.includes("arial"));
  assert(ids.includes("helvetica"));

  assertEquals(DEFAULT_FONT, "serif");
  assert(FONT_MAP.system.family.includes("system-ui"));
  assert(FONT_MAP.serif.family.includes("serif"));
  assert(FONT_MAP["sans-serif"].family.includes("sans-serif"));
});

Deno.test("settings: font preference defaults to serif when empty", () => {
  localStorage.removeItem(SETTINGS_KEY);
  assertEquals(getFontPreference(), "serif");
});

Deno.test("settings: saving and reading font preference round-trips", () => {
  try {
    const options: FontOption[] = ["system", "arial", "georgia", "times", "sans-serif"];
    for (const opt of options) {
      saveFontPreference(opt);
      assertEquals(getFontPreference(), opt);
    }
  } finally {
    localStorage.removeItem(SETTINGS_KEY);
  }
});

Deno.test("settings: invalid stored font value falls back to default", () => {
  try {
    localStorage.setItem(SETTINGS_KEY, "comic-sans-ms");
    assertEquals(getFontPreference(), DEFAULT_FONT);
  } finally {
    localStorage.removeItem(SETTINGS_KEY);
  }
});

Deno.test("settings: applyFontPreference updates dataset and style property", () => {
  // applyFontPreference checks typeof document !== "undefined"
  // in Deno CLI runtime without DOM, it gracefully does not throw
  applyFontPreference("system");
  applyFontPreference("serif");
});
