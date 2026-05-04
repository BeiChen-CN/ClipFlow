import type { MotionPreset } from "./types";

export const md3Ease: [number, number, number, number] = [0.2, 0, 0, 1];
export const md3ExpressiveEase: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const md3DepthEase: [number, number, number, number] = [0.12, 0.85, 0.22, 1];
export const md3SwiftEase: [number, number, number, number] = [0.2, 0.9, 0.1, 1];

export type RouteDirection = "toSettings" | "toClipboard";

type EaseCurve = [number, number, number, number];
type LayerDelays = {
  header: number;
  search: number;
  filter: number;
  list: number;
  rows: number;
  footer: number;
};

type SpringConfig = {
  damping: number;
  mass: number;
  stiffness: number;
};

type MotionProfile = {
  buttonHoverScale: number;
  buttonTapScale: number;
  clipboardLayerY: number;
  clipboardPanelScale: number;
  clipboardPanelY: number;
  clipboardPanelOvershootScale?: number;
  clipboardPanelOvershootY?: number;
  confirmDialogScale: number;
  confirmDialogY: number;
  delayMultiplier: number;
  ease: EaseCurve;
  expressiveEase: EaseCurve;
  layerDelays?: LayerDelays;
  panelScale: number;
  panelY: number;
  routeScale: number;
  routeX: number;
  rowDelayStep: number;
  rowMaxDelay: number;
  sectionY: number;
  spring?: SpringConfig;
  timings: {
    clipboardLayer: number;
    clipboardPanel: number;
    confirmDialog: number;
    editor: number;
    editorExit: number;
    iconButton: number;
    panel: number;
    route: number;
    row: number;
    section: number;
  };
};

export const motionPresetOptions: Array<{ id: MotionPreset; label: string; description: string }> = [
  { id: "a", label: "稳态", description: "保留当前节奏, 低干扰" },
  { id: "b", label: "层次", description: "更明显的纵深和分层" },
  { id: "c", label: "流线", description: "更快的滑入和切换" },
  { id: "d", label: "弹性", description: "带轻弹性的反馈" }
];

const baseLayerDelays = {
  header: 0,
  search: 0.03,
  filter: 0.07,
  list: 0.1,
  rows: 0.12,
  footer: 0.15
} as const satisfies LayerDelays;

const profiles: Record<MotionPreset, MotionProfile> = {
  a: {
    buttonHoverScale: 1.015,
    buttonTapScale: 0.97,
    clipboardLayerY: 4,
    clipboardPanelScale: 0.99,
    clipboardPanelY: 10,
    confirmDialogScale: 0.98,
    confirmDialogY: 10,
    delayMultiplier: 1,
    ease: md3Ease,
    expressiveEase: md3ExpressiveEase,
    panelScale: 0.995,
    panelY: 8,
    routeScale: 0.985,
    routeX: 12,
    rowDelayStep: 0.005,
    rowMaxDelay: 0.025,
    sectionY: 6,
    timings: {
      clipboardLayer: 0.12,
      clipboardPanel: 0.2,
      confirmDialog: 0.16,
      editor: 0.16,
      editorExit: 0.12,
      iconButton: 0.12,
      panel: 0.17,
      route: 0.26,
      row: 0.1,
      section: 0.13
    }
  },
  b: {
    buttonHoverScale: 1.02,
    buttonTapScale: 0.965,
    clipboardLayerY: 7,
    clipboardPanelScale: 0.982,
    clipboardPanelY: 16,
    confirmDialogScale: 0.965,
    confirmDialogY: 14,
    delayMultiplier: 1.18,
    ease: md3Ease,
    expressiveEase: md3DepthEase,
    panelScale: 0.986,
    panelY: 14,
    routeScale: 0.975,
    routeX: 20,
    rowDelayStep: 0.007,
    rowMaxDelay: 0.04,
    sectionY: 9,
    timings: {
      clipboardLayer: 0.15,
      clipboardPanel: 0.25,
      confirmDialog: 0.2,
      editor: 0.2,
      editorExit: 0.15,
      iconButton: 0.15,
      panel: 0.22,
      route: 0.32,
      row: 0.13,
      section: 0.17
    }
  },
  c: {
    buttonHoverScale: 1.012,
    buttonTapScale: 0.975,
    clipboardLayerY: 3,
    clipboardPanelScale: 0.994,
    clipboardPanelY: 8,
    confirmDialogScale: 0.985,
    confirmDialogY: 8,
    delayMultiplier: 0.78,
    ease: md3Ease,
    expressiveEase: md3SwiftEase,
    panelScale: 0.997,
    panelY: 6,
    routeScale: 0.99,
    routeX: 24,
    rowDelayStep: 0.003,
    rowMaxDelay: 0.018,
    sectionY: 4,
    timings: {
      clipboardLayer: 0.1,
      clipboardPanel: 0.17,
      confirmDialog: 0.13,
      editor: 0.13,
      editorExit: 0.09,
      iconButton: 0.1,
      panel: 0.14,
      route: 0.21,
      row: 0.08,
      section: 0.1
    }
  },
  d: {
    buttonHoverScale: 1.025,
    buttonTapScale: 0.94,
    clipboardLayerY: 8,
    clipboardPanelScale: 0.955,
    clipboardPanelY: 20,
    clipboardPanelOvershootScale: 1.014,
    clipboardPanelOvershootY: -2,
    confirmDialogScale: 0.972,
    confirmDialogY: 12,
    delayMultiplier: 1,
    ease: md3Ease,
    expressiveEase: md3ExpressiveEase,
    layerDelays: {
      header: 0,
      search: 0.055,
      filter: 0.11,
      list: 0.165,
      rows: 0.19,
      footer: 0.23
    },
    panelScale: 0.99,
    panelY: 10,
    routeScale: 0.982,
    routeX: 16,
    rowDelayStep: 0.03,
    rowMaxDelay: 0.09,
    sectionY: 7,
    timings: {
      clipboardLayer: 0.38,
      clipboardPanel: 0.66,
      confirmDialog: 0.24,
      editor: 0.24,
      editorExit: 0.11,
      iconButton: 0.16,
      panel: 0.28,
      route: 0.38,
      row: 0.34,
      section: 0.22
    }
  }
};

export function createMotionSettings(preset: MotionPreset = "a") {
  const profile = profiles[preset] ?? profiles.a;
  const settingsSectionTransition = transitionFor(profile, profile.timings.section, profile.ease);
  const clipboardLayerDelays = profile.layerDelays ?? scaleDelays(baseLayerDelays, profile.delayMultiplier);
  const hasClipboardPanelOvershoot =
    profile.clipboardPanelOvershootY !== undefined || profile.clipboardPanelOvershootScale !== undefined;
  const clipboardPanelMotion = {
    initial: { opacity: 0, y: profile.clipboardPanelY, scale: profile.clipboardPanelScale },
    animate: hasClipboardPanelOvershoot
      ? {
          opacity: 1,
          y: [profile.clipboardPanelY, profile.clipboardPanelOvershootY ?? 0, 0],
          scale: [profile.clipboardPanelScale, profile.clipboardPanelOvershootScale ?? 1, 1]
        }
      : { opacity: 1, y: 0, scale: 1 },
    transition: hasClipboardPanelOvershoot
      ? tween(profile.timings.clipboardPanel, profile.expressiveEase)
      : transitionFor(profile, profile.timings.clipboardPanel, profile.expressiveEase)
  };
  const clipEditorMotion = {
    contentInitial: { opacity: 0 },
    contentAnimate: {
      opacity: 1,
      transition: transitionFor(profile, Math.max(profile.timings.editor - 0.04, 0.08), profile.ease, 0.02)
    },
    contentExit: {
      opacity: 0,
      transition: transitionFor(profile, Math.max(profile.timings.editorExit - 0.04, 0.06), profile.ease)
    },
    editorInitial: { opacity: 0, y: profile.sectionY },
    editorAnimate: {
      opacity: 1,
      y: 0,
      transition: transitionFor(profile, profile.timings.editor, profile.ease, 0.04)
    },
    editorExit: {
      opacity: 0,
      y: Math.max(profile.sectionY - 1, 3),
      transition: transitionFor(profile, profile.timings.editorExit, profile.ease)
    },
    layoutTransition: transitionFor(profile, profile.timings.route, profile.ease)
  };

  return {
    buttonHover: { y: -1, scale: profile.buttonHoverScale },
    buttonTap: { scale: profile.buttonTapScale },
    clipboardLayerDelays,
    clipboardLayerMotion: {
      initial: { opacity: 0, y: profile.clipboardLayerY },
      animate: { opacity: 1, y: 0 }
    },
    clipboardLayerTransition: (delay = 0) =>
      transitionFor(profile, profile.timings.clipboardLayer, profile.expressiveEase, delay),
    clipboardPanelMotion,
    clipEditorMotion,
    clipRowTransition: (index: number, baseDelay = 0, editing = false) => {
      if (editing) {
        return clipEditorMotion.layoutTransition;
      }

      return {
        ...settingsSectionTransition,
        duration: profile.timings.row,
        delay: baseDelay + Math.min(index * profile.rowDelayStep, profile.rowMaxDelay)
      };
    },
    confirmDialogMotion: {
      backdropInitial: { opacity: 0 },
      backdropAnimate: { opacity: 1 },
      backdropExit: { opacity: 0 },
      backdropTransition: tween(0.14, md3Ease),
      dialogInitial: { opacity: 0, y: profile.confirmDialogY, scale: profile.confirmDialogScale },
      dialogAnimate: { opacity: 1, y: 0, scale: 1 },
      dialogExit: { opacity: 0, y: Math.max(profile.confirmDialogY - 2, 6), scale: profile.confirmDialogScale },
      dialogTransition: transitionFor(profile, profile.timings.confirmDialog, profile.ease)
    },
    feedbackTransition: { ...settingsSectionTransition },
    feedbackVariants: {
      initial: { opacity: 0, y: Math.max(profile.clipboardLayerY, 3) },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -3 }
    },
    magneticSpring: transitionFor(profile, profile.timings.iconButton, profile.ease),
    panelMotion: {
      initial: { opacity: 0, y: profile.panelY, scale: profile.panelScale },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: transitionFor(profile, profile.timings.panel, profile.expressiveEase)
    },
    routeTransition: transitionFor(profile, profile.timings.route, profile.expressiveEase),
    routeVariants: {
      initial: (direction: RouteDirection) => ({
        opacity: 0,
        x: direction === "toSettings" ? profile.routeX : -profile.routeX,
        scale: profile.routeScale
      }),
      animate: { opacity: 1, x: 0, scale: 1 },
      exit: (direction: RouteDirection) => ({
        opacity: 0,
        x: direction === "toSettings" ? -profile.routeX : profile.routeX,
        scale: Math.min(profile.routeScale + 0.007, 0.996)
      })
    },
    settingsSectionTransition,
    settingsSectionVariants: {
      initial: { opacity: 0, y: profile.sectionY },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -Math.max(profile.sectionY - 2, 3) }
    }
  };
}

function scaleDelays(delays: LayerDelays, multiplier: number): LayerDelays {
  return {
    header: roundDelay(delays.header * multiplier),
    search: roundDelay(delays.search * multiplier),
    filter: roundDelay(delays.filter * multiplier),
    list: roundDelay(delays.list * multiplier),
    rows: roundDelay(delays.rows * multiplier),
    footer: roundDelay(delays.footer * multiplier)
  };
}

function transitionFor(profile: MotionProfile, duration: number, ease: EaseCurve, delay = 0) {
  if (profile.spring) {
    return spring(profile.spring, delay);
  }

  return tween(duration, ease, delay);
}

function tween(duration: number, ease: EaseCurve, delay = 0) {
  return delay > 0
    ? { type: "tween" as const, duration, ease, delay }
    : { type: "tween" as const, duration, ease };
}

function spring(config: SpringConfig, delay = 0) {
  return delay > 0
    ? { type: "spring" as const, ...config, delay }
    : { type: "spring" as const, ...config };
}

function roundDelay(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const defaultMotionSettings = createMotionSettings("a");

export const panelMotion = defaultMotionSettings.panelMotion;
export const clipboardPanelMotion = defaultMotionSettings.clipboardPanelMotion;
export const clipboardLayerMotion = defaultMotionSettings.clipboardLayerMotion;
export const clipboardLayerDelays = defaultMotionSettings.clipboardLayerDelays;
export const routeVariants = defaultMotionSettings.routeVariants;
export const routeTransition = defaultMotionSettings.routeTransition;
export const settingsSectionVariants = defaultMotionSettings.settingsSectionVariants;
export const settingsSectionTransition = defaultMotionSettings.settingsSectionTransition;
export const magneticSpring = defaultMotionSettings.magneticSpring;
export const clipEditorMotion = defaultMotionSettings.clipEditorMotion;
export const feedbackVariants = defaultMotionSettings.feedbackVariants;
export const feedbackTransition = defaultMotionSettings.feedbackTransition;

export function clipboardLayerTransition(delay = 0) {
  return defaultMotionSettings.clipboardLayerTransition(delay);
}

export function clipRowTransition(index: number, baseDelay = 0, editing = false) {
  return defaultMotionSettings.clipRowTransition(index, baseDelay, editing);
}
