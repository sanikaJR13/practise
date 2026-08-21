import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox
}) {
  return (
    <Card className="flex flex-col items-center gap-4 p-10 text-center">
      <div className="rounded-2xl bg-surface-container-low p-4 text-on-surface-variant">
        <Icon className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <h3 className="font-headline text-xl font-bold text-primary">{title}</h3>
        <p className="max-w-md text-sm text-on-surface-variant">{description}</p>
      </div>
      {actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </Card>
  );
}
