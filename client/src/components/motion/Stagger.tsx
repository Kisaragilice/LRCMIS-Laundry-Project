import type { ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '../ui';
import { durations, smoothEase } from '../../lib/motion';

type StaggerProps = HTMLMotionProps<'div'> & {
  children: ReactNode;
  once?: boolean;
  amount?: number;
  stagger?: number;
  delayChildren?: number;
};

export function Stagger({
  children,
  className,
  once = true,
  amount = 0.12,
  stagger = 0.11,
  delayChildren = 0.06,
  ...props
}: StaggerProps) {
  return (
    <motion.div
      {...props}
      className={cn(className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount, margin: '0px 0px -8% 0px' }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: stagger,
            delayChildren,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = HTMLMotionProps<'div'> & {
  children: ReactNode;
  distance?: number;
  blur?: boolean;
  duration?: number;
};

export function StaggerItem({
  children,
  className,
  distance = 20,
  blur = false,
  duration = durations.reveal,
  ...props
}: StaggerItemProps) {
  return (
    <motion.div
      {...props}
      className={cn(className)}
      variants={{
        hidden: {
          opacity: 0,
          y: distance,
          ...(blur ? { filter: 'blur(5px)' } : {}),
        },
        show: {
          opacity: 1,
          y: 0,
          ...(blur ? { filter: 'blur(0px)' } : {}),
          transition: { duration, ease: smoothEase },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
