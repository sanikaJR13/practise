import { cn } from '@/lib/utils/cn';

export function Field({ label, hint, error, children }) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          {label}
        </span>
        {hint ? <span className="text-xs text-on-surface-variant">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs font-medium text-error">{error}</p> : null}
    </label>
  );
}

export function TextInput({ className, ...props }) {
  return <input className={cn('field-shell w-full', className)} {...props} />;
}

export function SelectInput({ className, children, ...props }) {
  return (
    <select className={cn('field-shell w-full appearance-none', className)} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...props }) {
  return <textarea className={cn('field-shell min-h-28 w-full resize-none', className)} {...props} />;
}

export function Checkbox({ className, ...props }) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/20',
        className
      )}
      {...props}
    />
  );
}
