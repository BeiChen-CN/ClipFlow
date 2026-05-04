import { afterEach, describe, expect, it } from "vitest";
import {
  CLIPBOARD_WINDOW_SIZE,
  DESKTOP_MIN_WINDOW_SIZE,
  DESKTOP_WINDOW_BOUNDS_STORAGE_KEY,
  SETTINGS_WINDOW_SIZE,
  clearDesktopWindowBoundsMemory,
  readDesktopWindowBoundsMemory,
  resolveDesktopWindowSize,
  suppressNextFocusLossHide,
  writeDesktopWindowBoundsMemory
} from "./desktopWindow";

describe("desktop window sizing", () => {
  afterEach(() => {
    clearDesktopWindowBoundsMemory();
  });

  it("uses compact clipboard and settings route defaults", () => {
    expect(CLIPBOARD_WINDOW_SIZE).toEqual({ width: 525, height: 865 });
    expect(SETTINGS_WINDOW_SIZE).toEqual({ width: 1000, height: 700 });
    expect(DESKTOP_MIN_WINDOW_SIZE.width).toBeLessThanOrEqual(CLIPBOARD_WINDOW_SIZE.width);
    expect(resolveDesktopWindowSize("clipboard")).toEqual(CLIPBOARD_WINDOW_SIZE);
    expect(resolveDesktopWindowSize("settings")).toEqual(SETTINGS_WINDOW_SIZE);
  });

  it("persists clipboard and settings window sizes independently", () => {
    writeDesktopWindowBoundsMemory("clipboard", { width: 640, height: 900 });
    writeDesktopWindowBoundsMemory("settings", { width: 980, height: 720 });

    expect(readDesktopWindowBoundsMemory("clipboard")).toEqual({ width: 640, height: 900 });
    expect(readDesktopWindowBoundsMemory("settings")).toEqual({ width: 980, height: 720 });
    expect(resolveDesktopWindowSize("clipboard")).toEqual({ width: 640, height: 900 });
    expect(resolveDesktopWindowSize("settings")).toEqual({ width: 980, height: 720 });
  });

  it("ignores malformed remembered window sizes", () => {
    window.localStorage.setItem(
      DESKTOP_WINDOW_BOUNDS_STORAGE_KEY,
      JSON.stringify({ clipboard: { width: 0, height: 900 }, settings: { width: "large" } })
    );

    expect(readDesktopWindowBoundsMemory("clipboard")).toBeNull();
    expect(readDesktopWindowBoundsMemory("settings")).toBeNull();
    expect(resolveDesktopWindowSize("clipboard")).toEqual(CLIPBOARD_WINDOW_SIZE);
    expect(resolveDesktopWindowSize("settings")).toEqual(SETTINGS_WINDOW_SIZE);
  });

  it("keeps focus-loss suppression as a browser-safe no-op", async () => {
    await expect(suppressNextFocusLossHide()).resolves.toBeUndefined();
  });
});
