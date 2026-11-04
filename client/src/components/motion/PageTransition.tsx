import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { cn } from '../ui';
import { transitionPage } from '../../lib/motion';

export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  const { pathname } = useLocation();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 14, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={transitionPage}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
