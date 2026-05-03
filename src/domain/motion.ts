export const md3Ease: [number, number, number, number] = [0.2, 0, 0, 1];

export const panelMotion = {
  initial: { opacity: 0, y: 18, scale: 0.982, borderRadius: 34 },
  animate: { opacity: 1, y: 0, scale: 1, borderRadius: 28 },
  transition: { duration: 0.26, ease: md3Ease }
};

export const routeVariants = {
  initial: { opacity: 0, x: 42, scale: 0.992 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -30, scale: 0.996 }
};

export const routeTransition = { duration: 0.28, ease: md3Ease };

export const settingsSectionVariants = {
  initial: { opacity: 0, x: 34, scale: 0.99 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -22, scale: 0.995 }
};

export const settingsSectionTransition = { duration: 0.24, ease: md3Ease };

export const magneticSpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 36,
  mass: 0.9
};

export function clipRowTransition(index: number) {
  return {
    duration: 0.2,
    ease: md3Ease,
    delay: Math.min(index * 0.035, 0.18)
  };
}

export const feedbackVariants = {
  initial: { opacity: 0, x: 22, scale: 0.94 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -14, scale: 0.96 }
};

export const feedbackTransition = { duration: 0.18, ease: md3Ease };
