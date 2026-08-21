import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

const styles = {
  primary:
    'bg-primary text-on-primary shadow-sm hover:opacity-95 active:scale-[0.99] disabled:opacity-50',
  secondary:
    'border border-outline-variant/30 bg-surface-container-lowest text-primary hover:bg-surface-container-low disabled:opacity-50',
  ghost: 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary disabled:opacity-50',
  danger:
    'bg-error text-on-error shadow-sm hover:opacity-95 active:scale-[0.99] disabled:opacity-50'
};

export const Button = forwardRef(function Button(
  { asChild = false, className, variant = 'primary', size = 'md', ...props },
  ref
) {
  const Component = asChild ? 'span' : 'button';
  const sizeStyles =
    size === 'sm'
      ? 'rounded-xl px-3.5 py-2 text-sm font-semibold'
      : 'rounded-2xl px-4 py-3 text-sm font-semibold';

  return (
    <Component
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-label transition',
        styles[variant],
        sizeStyles,
        className
      )}
      {...props}
    />
  );
});
