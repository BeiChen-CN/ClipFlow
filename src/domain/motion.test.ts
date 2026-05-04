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
});
