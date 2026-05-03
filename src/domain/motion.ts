export const md3Ease: [number, number, number, number] = [0.2, 0, 0, 1];
export const md3ExpressiveEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const panelMotion = {
  initial: { opacity: 0, y: 8, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: {
    type: "tween" as const,
    duration: 0.17,
    ease: md3ExpressiveEase
  }
};

export const clipboardPanelMotion = {
  initial: { opacity: 0, y: 10, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: {
    type: "tween" as const,
    duration: 0.2,
    ease: md3ExpressiveEase
  }
};

export const clipboardLayerMotion = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 }
};

export const clipboardLayerDelays = {
  header: 0,
  search: 0.03,
  filter: 0.07,
  list: 0.1,
  rows: 0.12,
  footer: 0.15
} as const;

export function clipboardLayerTransition(delay = 0) {
  return {
    type: "tween" as const,
    duration: 0.12,
    ease: md3ExpressiveEase,
    delay
  };
}

export type RouteDirection = "toSettings" | "toClipboard";

export const routeVariants = {
  initial: (direction: RouteDirection) => ({
    opacity: 0,
    x: direction === "toSettings" ? 24 : -24
  }),
  animate: { opacity: 1, x: 0 },
  exit: (direction: RouteDirection) => ({
    opacity: 0,
    x: direction === "toSettings" ? -18 : 18
  })
};

export const routeTransition = {
  type: "tween" as const,
  duration: 0.26,
  ease: md3Ease
};

export const settingsSectionVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 }
};

export const settingsSectionTransition = {
  type: "tween" as const,
  duration: 0.13,
  ease: md3Ease
};

export const magneticSpring = {
  type: "tween" as const,
  duration: 0.14,
  ease: md3Ease
};

export const clipEditorMotion = {
  contentInitial: { opacity: 0 },
  contentAnimate: {
    opacity: 1,
    transition: {
      type: "tween" as const,
      duration: 0.12,
      ease: md3Ease,
      delay: 0.02
    }
  },
  contentExit: {
    opacity: 0,
    transition: {
      type: "tween" as const,
      duration: 0.08,
      ease: md3Ease
    }
  },
  editorInitial: { opacity: 0, y: 6 },
  editorAnimate: {
    opacity: 1,
    y: 0,
    transition: {
      type: "tween" as const,
      duration: 0.16,
      ease: md3Ease,
      delay: 0.04
    }
  },
  editorExit: {
    opacity: 0,
    y: 5,
    transition: {
      type: "tween" as const,
      duration: 0.12,
      ease: md3Ease
    }
  },
  layoutTransition: {
    type: "tween" as const,
    duration: 0.26,
    ease: md3Ease
  }
};

export function clipRowTransition(index: number, baseDelay = 0, editing = false) {
  if (editing) {
    return clipEditorMotion.layoutTransition;
  }

  return {
    ...settingsSectionTransition,
    duration: 0.1,
    delay: baseDelay + Math.min(index * 0.005, 0.025)
  };
}

export const feedbackVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -3 }
};

export const feedbackTransition = {
  ...settingsSectionTransition
};
