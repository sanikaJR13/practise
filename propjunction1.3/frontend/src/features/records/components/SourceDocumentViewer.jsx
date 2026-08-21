import { AlertCircle, Download, FileSearch, Minus, Plus, Printer, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

function clampZoom(value) {
  return Math.min(1.7, Math.max(0.75, Number(value.toFixed(2))));
}

function getEvidenceLabel(item) {
  return String(item?.sourceField || item?.sourceSection || item?.id || 'Evidence')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getEvidenceValue(item) {
  const value = item?.normalizedValue ?? item?.rawValue ?? item?.citation;
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ') || 'Not surfaced';
  }

  if (value && typeof value === 'object') {
    return 'Structured evidence available';
  }

  return value || 'Not surfaced';
}

function EvidencePlaceholderSheet({ detail, evidenceItems, activeEvidenceId, onEvidenceSelect }) {
  const identity = detail?.extractedFacts?.propertyIdentity ?? {};
  const area = detail?.extractedFacts?.area ?? {};
  const owners = detail?.extractedFacts?.ownership?.owners ?? [];
  const mutationRefs = detail?.extractedFacts?.rightsAndMutation?.oldMutationNumbers ?? [];

  return (
    <div className="mx-auto min-h-[58rem] w-[52rem] rounded-[1.35rem] border border-outline-variant/30 bg-white p-8 shadow-[0_24px_60px_rgba(3,22,50,0.16)]">
      <div className="border-b border-outline-variant/20 pb-5 text-center">
        <p className="section-eyebrow">Maharashtra Government Record</p>
        <h3 className="mt-3 font-document text-4xl font-semibold text-primary">7/12 Extract Review Copy</h3>
        <p className="mt-2 text-sm text-on-surface-variant">
          Government document preview unavailable. Artifact available in audit mode if surfaced by the workflow.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          ['District', identity.district],
          ['Taluka', identity.taluka],
          ['Village', identity.village],
          ['Survey Number', identity.surveyNumber],
          ['Khata Number', identity.khataNumber],
          ['Extract Date', identity.extractDate]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1rem] border border-outline-variant/20 bg-surface-container-low px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{label}</p>
            <p className="mt-2 text-sm font-semibold text-primary">{value || 'Not surfaced'}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[1.2rem] border border-outline-variant/20 p-5">
        <p className="section-eyebrow">Visible Record Information</p>
        <div className="mt-4 grid gap-3">
          <p className="text-sm leading-6 text-on-surface-variant">
            Total area: <span className="font-semibold text-primary">{area.totalArea || 'Not surfaced'}</span>
          </p>
          <p className="text-sm leading-6 text-on-surface-variant">
            Cultivable area: <span className="font-semibold text-primary">{area.cultivableArea || 'Not surfaced'}</span>
          </p>
          <p className="text-sm leading-6 text-on-surface-variant">
            Extracted owner signals:{' '}
            <span className="font-semibold text-primary">
              {owners.length ? owners.join(', ') : 'Reviewer verification required'}
            </span>
          </p>
          <p className="text-sm leading-6 text-on-surface-variant">
            Mutation references:{' '}
            <span className="font-semibold text-primary">{mutationRefs.length ? mutationRefs.join(', ') : 'Not surfaced'}</span>
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <p className="section-eyebrow">Evidence Hooks</p>
        {evidenceItems.slice(0, 8).map((item) => {
          const active = activeEvidenceId === item.id;
          return (
            <button
              key={item.id ?? `${item.sourceSection}-${item.sourceField}`}
              type="button"
              onClick={() => onEvidenceSelect?.(item)}
              className={cn(
                'w-full rounded-[1rem] border px-4 py-3 text-left transition',
                active
                  ? 'border-primary/35 bg-primary-fixed/35 shadow-[0_12px_24px_rgba(3,22,50,0.08)]'
                  : 'border-outline-variant/20 bg-surface-container-lowest hover:border-primary/25 hover:bg-surface-container-low'
              )}
            >
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                {getEvidenceLabel(item)}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-primary">{getEvidenceValue(item)}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SourceDocumentViewer({
  detail,
  documentUrl,
  documentMimeType,
  document,
  zoom,
  onZoomChange,
  documentLoading = false,
  documentError = null,
  evidenceItems = [],
  activeEvidence,
  onEvidenceSelect,
  onDownload,
  onPrint
}) {
  const hasDocument = Boolean(documentUrl);
  const isPdf = /pdf/i.test(documentMimeType || document?.mimeType || '');
  const activeEvidenceId = activeEvidence?.id ?? null;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-outline-variant/16 bg-surface-container-lowest shadow-[0_28px_70px_rgba(3,22,50,0.08)]">
      <div className="border-b border-outline-variant/12 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="section-eyebrow">Government Evidence</p>
            <h2 className="mt-2 font-headline text-2xl font-extrabold text-primary">Source Document Viewer</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-[1rem] border border-outline-variant/20 bg-surface-container-low p-1">
              <button
                type="button"
                className="rounded-[0.8rem] p-2 text-on-surface-variant hover:bg-white hover:text-primary"
                onClick={() => onZoomChange?.(clampZoom(zoom - 0.1))}
                aria-label="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-14 px-2 text-center text-sm font-semibold text-primary">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="rounded-[0.8rem] p-2 text-on-surface-variant hover:bg-white hover:text-primary"
                onClick={() => onZoomChange?.(clampZoom(zoom + 0.1))}
                aria-label="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Button type="button" variant="secondary" onClick={onDownload} disabled={!hasDocument && !document?.downloadUrl}>
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button type="button" variant="secondary" onClick={onPrint}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[1.15rem] border border-outline-variant/16 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          <Search className="h-4 w-4" />
          <span>Search within document is ready for backend text index integration.</span>
        </div>
      </div>

      <div className="grid min-h-[72vh] gap-0 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="overflow-auto bg-surface-container-low p-4 sm:p-6" style={{ maxHeight: 'calc(100vh - 11rem)' }}>
          {documentLoading ? (
            <div className="flex min-h-[34rem] items-center justify-center rounded-[1.4rem] border border-dashed border-outline-variant/30 bg-white text-sm font-semibold text-on-surface-variant">
              Loading government document...
            </div>
          ) : documentError ? (
            <div className="flex min-h-[34rem] flex-col items-center justify-center rounded-[1.4rem] border border-error/20 bg-error-container/40 p-8 text-center">
              <AlertCircle className="h-8 w-8 text-on-error-container" />
              <h3 className="mt-4 font-headline text-xl font-extrabold text-primary">Government document preview unavailable</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-on-error-container">
                The artifact could not be rendered in this workspace. Artifact available in audit mode if surfaced by the workflow.
              </p>
            </div>
          ) : hasDocument ? (
            <div className="mx-auto flex min-w-[760px] justify-center py-4">
              <div className="origin-top transition-transform duration-200" style={{ transform: `scale(${zoom})`, width: 860 }}>
                <div className="overflow-hidden rounded-[1.4rem] border border-outline-variant/25 bg-white shadow-[0_24px_60px_rgba(3,22,50,0.18)]">
                  <div className="flex items-center justify-between border-b border-outline-variant/16 bg-surface-container-low px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                    <span>Live Backend Document</span>
                    <span>{isPdf ? 'PDF Extract' : 'Image Extract'}</span>
                  </div>
                  {isPdf ? (
                    <iframe
                      src={documentUrl}
                      title={`7/12 source document ${detail?.property?.surveyNumber ?? ''}`}
                      className="h-[70vh] w-full bg-white"
                    />
                  ) : (
                    <img
                      src={documentUrl}
                      alt={`7/12 source document ${detail?.property?.surveyNumber ?? ''}`}
                      className="block h-auto w-full bg-white"
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="origin-top transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
              <EvidencePlaceholderSheet
                detail={detail}
                evidenceItems={evidenceItems}
                activeEvidenceId={activeEvidenceId}
                onEvidenceSelect={onEvidenceSelect}
              />
            </div>
          )}
        </div>

        <aside className="border-t border-outline-variant/12 bg-surface-container-lowest p-5 xl:border-l xl:border-t-0">
          <div className="flex items-center gap-3">
            <div className="rounded-[1rem] bg-primary-fixed/40 p-3 text-primary">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="section-eyebrow">Evidence Links</p>
              <p className="mt-1 text-sm font-semibold text-primary">{evidenceItems.length} surfaced</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {evidenceItems.slice(0, 10).map((item) => (
              <button
                key={item.id ?? `${item.sourceSection}-${item.sourceField}`}
                type="button"
                onClick={() => onEvidenceSelect?.(item)}
                className={cn(
                  'w-full rounded-[1rem] border px-3 py-3 text-left transition',
                  activeEvidenceId === item.id
                    ? 'border-primary/35 bg-primary-fixed/35'
                    : 'border-outline-variant/16 bg-surface-container-low hover:border-primary/25 hover:bg-white'
                )}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                  {getEvidenceLabel(item)}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-primary">{getEvidenceValue(item)}</p>
                {item.highlightRegion || item.pageNumber ? (
                  <p className="mt-2 text-xs font-semibold text-on-surface-variant">Highlight in document</p>
                ) : null}
              </button>
            ))}

            {!evidenceItems.length ? (
              <div className="rounded-[1rem] border border-dashed border-outline-variant/25 bg-surface-container-low p-4 text-sm leading-6 text-on-surface-variant">
                Evidence highlights are not available from current evidence.
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
