import type { Transition, Variants } from 'motion/react';

/** Soft deceleration — used for content entering the viewport. */
export const smoothEase: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** Slower in-out easing for ambient and looping motion. */
export const softEaseInOut: [number, number, number, number] = [0.65, 0, 0.35, 1];

export const durations = {
  micro: 0.2,
  quick: 0.34,
  reveal: 0.68,
  page: 0.46,
  ambient: 16,
} as const;

export const transitionMicro: Transition = {
  duration: durations.micro,
  ease: smoothEase,
};

export const transitionQuick: Transition = {
  duration: durations.quick,
  ease: smoothEase,
};

export const transitionReveal: Transition = {
  duration: durations.reveal,
  ease: smoothEase,
};

export const transitionPage: Transition = {
  duration: durations.page,
  ease: smoothEase,
};

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 220,
  damping: 28,
  mass: 0.9,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transitionQuick },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26, filter: 'blur(5px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: transitionReveal,
  },
};

export const fadeUpSmall: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: transitionReveal },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: transitionReveal },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.11,
      delayChildren: 0.06,
    },
  },
};

export const staggerItem: Variants = fadeUpSmall;

export const pageTransition = {
  initial: { opacity: 0, y: 14, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: transitionPage,
} as const;
