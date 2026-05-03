import type { CSSProperties } from "react";
import type { Settings } from "./types";

const fallbackCustomColor = "#0d9488";

export function readCustomColor(settings: Pick<Settings, "customColor">): string {
  return normalizeHexColor(settings.customColor) ?? fallbackCustomColor;
}

export function normalizeHexColor(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const shortMatch = /^#?([0-9a-f]{3})$/i.exec(trimmed);
  if (shortMatch) {
    return `#${shortMatch[1]!
      .split("")
      .map((character) => `${character}${character}`)
      .join("")
      .toLowerCase()}`;
  }

  const longMatch = /^#?([0-9a-f]{6})$/i.exec(trimmed);
  return longMatch ? `#${longMatch[1]!.toLowerCase()}` : null;
}

export function createThemeStyle(
  settings: Pick<Settings, "colorPreset" | "customColor">
): CSSProperties | undefined {
  if (settings.colorPreset !== "custom") {
    return undefined;
  }

  return { "--custom-color": readCustomColor(settings) } as CSSProperties;
}
