import { cn } from '@/lib/utils/cn';

export function Card({ className, children }) {
  return <div className={cn('ambient-card', className)}>{children}</div>;
}
