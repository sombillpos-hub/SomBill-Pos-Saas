import { motion, type HTMLMotionProps } from 'framer-motion';

/**
 * Shared animation primitives (Framer Motion), so every dashboard animates the same way.
 * Durations stay short (≤ 200 ms) and AppProviders turns motion off for users who prefer reduced motion.
 */
export const transitions = {
  fast: { duration: 0.15, ease: 'easeOut' },
  base: { duration: 0.2, ease: 'easeOut' },
} as const;

/** Fades and lifts content in when it mounts: page bodies, cards, panels. */
export function FadeIn({ children, delay = 0, ...rest }: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.base, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Animates a list item in and out (use inside AnimatePresence). */
export function ListItemMotion({ children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={transitions.fast}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
