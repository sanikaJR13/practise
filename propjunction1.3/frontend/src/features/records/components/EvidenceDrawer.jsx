import { X, LocateFixed, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

function display(value, fallback = 'Not surfaced') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value.length ? value.map((item) => display(item, '')).filter(Boolean).join(', ') : fallback;
  }

  if (typeof value === 'object') {
    return 'Structured evidence available in audit mode';
  }

  return String(value);
}

function confidenceLabel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 'Not surfaced';
  }

  return numeric <= 1 ? `${Math.round(numeric * 100)}%` : `${Math.round(numeric)}%`;
}

export function EvidenceDrawer({ evidence, open, onClose, onHighlight }) {
  const visible = open && evidence;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition',
        visible ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          'absolute inset-0 bg-primary/25 backdrop-blur-[2px] transition-opacity',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-[30rem] flex-col border-l border-outline-variant/20 bg-surface-container-lowest shadow-[0_30px_90px_rgba(3,22,50,0.22)] transition-transform duration-200',
          visible ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Evidence details"
      >
        <div className="border-b border-outline-variant/12 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-eyebrow">Evidence Drawer</p>
              <h2 className="mt-2 font-headline text-2xl font-extrabold text-primary">
                {display(evidence?.normalizedValue ?? evidence?.sourceField ?? evidence?.sourceSection, 'Selected evidence')}
              </h2>
            </div>
            <button
              type="button"
              className="rounded-[1rem] border border-outline-variant/20 p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
              onClick={onClose}
              aria-label="Close evidence drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="info">{display(evidence?.sourceSection, 'evidence')}</Badge>
            <Badge tone="neutral">{display(evidence?.status, 'interpreted')}</Badge>
            <Badge tone="neutral">Confidence {confidenceLabel(evidence?.confidence)}</Badge>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          <div className="space-y-5">
            <section className="rounded-[1.3rem] border border-outline-variant/14 bg-surface-container-low p-5">
              <p className="section-eyebrow">Raw Evidence Text</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-primary">
                {display(evidence?.rawValue ?? evidence?.citation)}
              </p>
            </section>

            <section className="rounded-[1.3rem] border border-outline-variant/14 bg-surface-container-low p-5">
              <p className="section-eyebrow">Normalized Interpretation</p>
              <p className="mt-3 text-sm leading-7 text-primary">
                {display(evidence?.normalizedValue ?? evidence?.semanticMeaning)}
              </p>
              <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                {display(evidence?.semanticMeaning, 'Reviewer verification required before relying on this interpretation.')}
              </p>
            </section>

            <section className="rounded-[1.3rem] border border-outline-variant/14 bg-surface-container-low p-5">
              <p className="section-eyebrow">Source Citation</p>
              <div className="mt-3 grid gap-3 text-sm leading-6 text-on-surface-variant">
                <p>
                  Source section: <span className="font-semibold text-primary">{display(evidence?.sourceSection)}</span>
                </p>
                <p>
                  Source field: <span className="font-semibold text-primary">{display(evidence?.sourceField)}</span>
                </p>
                <p>
                  Citation: <span className="font-semibold text-primary">{display(evidence?.citation)}</span>
                </p>
              </div>
            </section>

            <section className="rounded-[1.3rem] border border-outline-variant/14 bg-surface-container-low p-5">
              <p className="section-eyebrow">Reviewer Guidance</p>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                Compare the interpretation with the visible government record and supporting workflow evidence. Use
                this as an evidence cue, not an autonomous legal conclusion.
              </p>
            </section>

            <section className="rounded-[1.3rem] border border-outline-variant/14 bg-surface-container-low p-5">
              <p className="section-eyebrow">Governance Labels</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="info">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  extracted evidence
                </Badge>
                <Badge tone="info">semantic interpretation</Badge>
                <Badge tone="neutral">reviewer verification required</Badge>
              </div>
            </section>
          </div>
        </div>

        <div className="border-t border-outline-variant/12 p-5">
          {evidence?.highlightRegion || evidence?.pageNumber ? (
            <Button type="button" className="w-full" onClick={() => onHighlight?.(evidence)}>
              <LocateFixed className="h-4 w-4" />
              Highlight in document
            </Button>
          ) : (
            <div className="rounded-[1rem] border border-dashed border-outline-variant/25 bg-surface-container-low px-4 py-3 text-sm leading-6 text-on-surface-variant">
              Highlight in document is not available from current evidence.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
