import { useRef, type ReactNode } from 'react';
import { useInView } from 'motion/react';
import { cn } from '../ui';

/**
 * Mounts chart children only when the chart area enters the viewport.
 * Recharts starts its entrance animation on mount, so this keeps the
 * animation visible instead of playing it off-screen.
 */
export function InViewChart({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25, margin: '0px 0px -10% 0px' });

  return (
    <div ref={ref} className={cn(className)}>
      {inView ? children : null}
    </div>
  );
}
