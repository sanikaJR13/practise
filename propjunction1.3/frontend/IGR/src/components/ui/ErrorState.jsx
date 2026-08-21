import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function ErrorState({ title, description, onRetry }) {
  return (
    <Card className="flex flex-col items-center gap-4 p-10 text-center">
      <div className="rounded-2xl bg-error-container p-4 text-on-error-container">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <h3 className="font-headline text-xl font-bold text-primary">{title}</h3>
        <p className="max-w-md text-sm text-on-surface-variant">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </Card>
  );
}
