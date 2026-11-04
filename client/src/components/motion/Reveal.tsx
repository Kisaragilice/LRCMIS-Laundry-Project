import type { ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '../ui';
import { durations, smoothEase } from '../../lib/motion';

type RevealProps = HTMLMotionProps<'div'> & {
  children: ReactNode;
  delay?: number;
  distance?: number;
  once?: boolean;
  amount?: number;
  scale?: number;
  blur?: boolean;
  duration?: number;
};

export function Reveal({
  children,
  className,
  delay = 0,
  distance = 26,
  once = true,
  amount = 0.18,
  scale,
  blur = false,
  duration = durations.reveal,
  ...props
}: RevealProps) {
  return (
    <motion.div
      {...props}
      className={cn(className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount, margin: '0px 0px -8% 0px' }}
      variants={{
        hidden: {
          opacity: 0,
          y: distance,
          ...(scale ? { scale } : {}),
          ...(blur ? { filter: 'blur(6px)' } : {}),
        },
        show: {
          opacity: 1,
          y: 0,
          ...(scale ? { scale: 1 } : {}),
          ...(blur ? { filter: 'blur(0px)' } : {}),
          transition: { duration, ease: smoothEase, delay },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
