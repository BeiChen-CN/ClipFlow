import { describe, expect, it } from "vitest";
import { createMotionSettings, motionPresetOptions } from "./motion";
import type { MotionPreset } from "./types";

describe("motion presets", () => {
  it("exposes all four selectable presets", () => {
    expect(motionPresetOptions.map((option) => option.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps preset A aligned with the previous steady baseline", () => {
    const motion = createMotionSettings("a");

    expect(motion.clipboardPanelMotion.initial).toEqual({ opacity: 0, y: 10, scale: 0.99 });
    expect(motion.routeTransition).toMatchObject({ type: "tween", duration: 0.26 });
    expect(motion.clipboardLayerDelays.footer).toBe(0.15);
  });

  it("gives each preset a distinct route and row cadence", () => {
    const presets: MotionPreset[] = ["a", "b", "c", "d"];
    const signatures = presets.map((preset) => {
      const motion = createMotionSettings(preset);
      return JSON.stringify({
        route: motion.routeTransition,
        row: motion.clipRowTransition(4, motion.clipboardLayerDelays.rows, false)
      });
    });

    expect(new Set(signatures).size).toBe(4);
  });

  it("uses the selected slow elastic clipboard opening cadence for preset D", () => {
    const motion = createMotionSettings("d");

    expect(motion.clipboardPanelMotion.initial).toEqual({ opacity: 0, y: 20, scale: 0.955 });
    expect(motion.clipboardPanelMotion.animate).toEqual({
      opacity: 1,
      y: [20, -2, 0],
      scale: [0.955, 1.014, 1]
    });
    expect(motion.clipboardPanelMotion.transition).toMatchObject({
      type: "tween",
      duration: 0.66
    });
    expect(motion.clipboardLayerDelays).toEqual({
      header: 0,
      search: 0.055,
      filter: 0.11,
      list: 0.165,
      rows: 0.19,
      footer: 0.23
    });
    expect(motion.clipRowTransition(3, motion.clipboardLayerDelays.rows, false)).toMatchObject({
      type: "tween",
      duration: 0.34,
      delay: 0.28
    });
  });
});
