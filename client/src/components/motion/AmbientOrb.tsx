import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../ui';

export function AmbientOrb({
  className,
  duration = 18,
  delay = 0,
  x = 18,
  y = 12,
  scale = 1.04,
}: {
  className?: string;
  duration?: number;
  delay?: number;
  x?: number;
  y?: number;
  scale?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className={cn('pointer-events-none', className)}
      animate={reduce ? { x: 0, y: 0, scale: 1 } : { x: [0, x, 0], y: [0, -y, 0], scale: [1, scale, 1] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}
