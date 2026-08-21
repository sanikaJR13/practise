import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export function AuditModePanel({
  title = 'Audit Appendix',
  description = 'Raw payloads are hidden in reviewer mode and appear only when audit mode is enabled.',
  payloads = []
}) {
  const items = payloads.filter((item) => item && item.payload !== undefined && item.payload !== null);

  if (!items.length) {
    return null;
  }

  return (
    <Card className="p-8">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-error-container/70 p-3 text-on-error-container">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="section-eyebrow">Audit Mode</p>
          <h2 className="mt-2 font-headline text-2xl font-extrabold text-primary">{title}</h2>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">{description}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <details key={item.label} className="rounded-[1.4rem] bg-surface-container-low p-5">
            <summary className="cursor-pointer list-none text-sm font-semibold text-primary">
              {item.label}
            </summary>
            <pre className="mt-4 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-[1.2rem] bg-surface-container-lowest p-4 text-xs leading-6 text-primary">
              {JSON.stringify(item.payload, null, 2)}
            </pre>
          </details>
        ))}
      </div>
    </Card>
  );
}
