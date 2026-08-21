import { cn } from '@/lib/utils/cn';

const badgeMap = {
  neutral: 'bg-surface-container text-on-surface-variant',
  success: 'bg-tertiary-fixed/40 text-on-tertiary-fixed-variant',
  warning: 'bg-error-container text-on-error-container',
  info: 'bg-primary-fixed text-on-primary-fixed'
};

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]',
        badgeMap[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
