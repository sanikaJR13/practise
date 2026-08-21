import { useState } from 'react'
import { ChevronDown, Database, ScanSearch, ShieldQuestion } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { WorkflowStatusBadge } from '@/features/records/components/WorkflowStatusBadge'
import { cn } from '@/lib/utils/cn'

function DetailRow({ label, value }) {
  return (
    <div className="rounded-[1.05rem] border border-outline-variant/15 bg-surface-container-lowest/82 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-primary">{value || 'Not surfaced'}</p>
    </div>
  )
}

function MiniJson({ label, value }) {
  return (
    <div className="rounded-[1.15rem] border border-outline-variant/15 bg-surface-container-lowest/82 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
      <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-on-surface-variant">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </div>
  )
}

export function SourceRunMetadataPanel({ technical, auditMode = false }) {
  const [open, setOpen] = useState(false)

  return (
    <Card className="overflow-hidden border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(242,244,246,0.95))] shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left"
      >
        <div>
          <p className="section-eyebrow">Source Run Technical Panel</p>
          <h2 className="mt-2 font-document text-[2rem] font-semibold leading-none text-primary">Workflow and scraper transparency</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
            This panel exposes the workflow, OCR, and source-run context behind the IGR evidence packet. Raw mapping objects remain available only in Audit Mode.
          </p>
        </div>
        <ChevronDown className={cn('mt-1 h-5 w-5 flex-shrink-0 text-on-surface-variant transition-transform', open && 'rotate-180')} />
      </button>

      <div className="px-6 pb-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailRow label="Source Run ID" value={`#${technical.sourceRunId}`} />
          <DetailRow label="Workflow Run ID" value={`#${technical.workflowRunId}`} />
          <DetailRow label="Scraper Run ID" value={technical.scraperRunId} />
          <DetailRow label="Workflow Step" value={technical.workflowStep} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="rounded-[1.15rem] border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="flex items-center gap-3">
              <ShieldQuestion className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Scraper status</p>
                <div className="mt-2">
                  <WorkflowStatusBadge status={technical.scraperStatus} />
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-[1.15rem] border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="flex items-center gap-3">
              <ScanSearch className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">OCR mode</p>
                <p className="mt-2 text-sm font-semibold text-primary">{technical.ocrMode}</p>
              </div>
            </div>
          </div>
          <div className="rounded-[1.15rem] border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-primary" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Metadata completeness</p>
                <p className="mt-2 text-sm font-semibold text-primary">{technical.metadataCompleteness}%</p>
              </div>
            </div>
          </div>
        </div>

        {open ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DetailRow label="Captcha mode" value={technical.captchaMode} />
              <DetailRow label="Year" value={technical.year} />
              <DetailRow label="Created at" value={technical.createdAt || 'Not surfaced'} />
              <DetailRow label="Completed at" value={technical.completedAt || 'Not surfaced'} />
            </div>

            <div className="rounded-[1.15rem] border border-outline-variant/15 bg-surface-container-low p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Year status chain</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {technical.yearStatuses.map((statusRow) => (
                  <div key={`${statusRow.year}-${statusRow.status}`} className="rounded-[1rem] bg-surface-container-lowest px-4 py-3">
                    <p className="text-sm font-semibold text-primary">{statusRow.year}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-on-surface-variant">{statusRow.status}</p>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      {statusRow.transactionCount} row{statusRow.transactionCount === 1 ? '' : 's'} / {statusRow.suspiciousCount} flagged
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {auditMode ? (
              <div className="grid gap-4 xl:grid-cols-3">
                <MiniJson label="Resolved mapping" value={technical.mapping} />
                <MiniJson label="Query params" value={technical.queryParams} />
                <MiniJson label="Input payload" value={technical.inputPayload} />
              </div>
            ) : (
              <div className="rounded-[1.15rem] border border-outline-variant/15 bg-surface-container-low p-4 text-sm leading-6 text-on-surface-variant">
                Raw mapping, query, and input payload details are available in Audit Mode.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
