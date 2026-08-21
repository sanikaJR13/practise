import { AlertCircle, CheckCircle2, FileSearch, ScanSearch, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { useAuditMode } from '@/lib/audit-mode'

function EvidenceRow({ label, value }) {
  return (
    <div className="rounded-[1rem] border border-outline-variant/15 bg-surface-container-lowest/82 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">{label}</p>
      <p className="mt-2 text-sm font-semibold text-primary">{value || 'Unavailable'}</p>
    </div>
  )
}

function JsonPreview({ label, value }) {
  const text = Object.keys(value || {}).length > 0 ? JSON.stringify(value, null, 2) : '{}'
  return (
    <div className="rounded-[1.2rem] border border-outline-variant/15 bg-surface-container-low p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{label}</p>
      <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs leading-6 text-on-surface-variant">{text}</pre>
    </div>
  )
}

export function TransactionDrawer({ transaction, technical, evidenceMeta, onClose, mobile = false }) {
  const auditMode = useAuditMode()
  const meta = technical ?? evidenceMeta ?? {}
  const sourceStatus = meta.scraperStatus ?? meta.sourceStatus ?? 'available'
  const sourceStatusTone = meta.sourceStatusTone ?? (sourceStatus === 'completed' ? 'success' : sourceStatus === 'failed' ? 'warning' : 'info')

  if (!transaction) {
    return (
      <Card className="border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(242,244,246,0.94))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
        <p className="section-eyebrow">Source Evidence Drawer</p>
        <h3 className="mt-3 font-document text-[1.9rem] font-semibold text-primary">Select a registry event</h3>
        <p className="mt-3 text-sm leading-7 text-on-surface-variant">
          Clicking a timeline node or forensic row opens the detailed transaction intelligence layer with normalized values, linkage status, and raw source evidence.
        </p>
      </Card>
    )
  }

  return (
    <Card className="border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(242,244,246,0.94))] p-0 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <div className="border-b border-outline-variant/10 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-eyebrow">Source Evidence Drawer</p>
            <h3 className="mt-2 font-document text-[1.9rem] font-semibold leading-none text-primary">{transaction.type}</h3>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              Evidence-backed transaction intelligence built from the live source-run payload without altering backend field contracts.
            </p>
          </div>
          {mobile ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-outline-variant/20 p-2 text-on-surface-variant"
              aria-label="Close source evidence drawer"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{transaction.type}</Badge>
          <Badge tone={sourceStatusTone}>{sourceStatus}</Badge>
          <Badge tone="info">Source year {transaction.sourceYear}</Badge>
          <Badge tone={transaction.matchStatus === 'unmatched' ? 'warning' : transaction.matchStatus === 'exact' ? 'success' : 'info'}>
            {transaction.legalLinkageStatus}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <EvidenceRow label="Seller" value={transaction.seller} />
          <EvidenceRow label="Buyer" value={transaction.buyer} />
          <EvidenceRow label="Registry date" value={transaction.dateLabel} />
          <EvidenceRow label="Consideration" value={transaction.considerationLabel} />
          <EvidenceRow label="Area" value={transaction.areaLabel} />
          <EvidenceRow label="Survey reference" value={transaction.surveyReferenceLabel} />
          <EvidenceRow label="Workflow step" value={transaction.workflowStep} />
          <EvidenceRow label="Continuity status" value={transaction.continuityStatus} />
        </div>

        <div className="rounded-[1.35rem] border border-outline-variant/15 bg-surface-container-low p-4">
          <div className="flex items-start gap-3">
            <FileSearch className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-primary">Property description</p>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">{transaction.propertyDescription}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-outline-variant/15 bg-surface-container-lowest/82 p-4">
          <div className="flex items-start gap-3">
            <ScanSearch className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-primary">Property linkage reasoning</p>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">{transaction.matchExplanation}</p>
              {transaction.matchedKeywords?.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {transaction.matchedKeywords.map((keyword) => (
                    <span key={`${transaction.id}-${keyword}`} className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-primary">
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-outline-variant/15 bg-surface-container-lowest/82 p-4">
          <div className="flex items-start gap-3">
            {sourceStatus === 'completed' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 text-on-error-container" />
            )}
            <div>
              <p className="text-sm font-semibold text-primary">Workflow context</p>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                Source run {meta.scraperRunId ?? meta.runId ?? transaction.runId ?? 'Unavailable'} is marked as {sourceStatus}. OCR confidence is{' '}
                {transaction.ocrConfidence !== null && transaction.ocrConfidence !== undefined ? `${transaction.ocrConfidence}%` : 'not exposed'} in this row.
              </p>
              {transaction.suspiciousReasons?.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
                  {transaction.suspiciousReasons.map((reason) => (
                    <li key={`${transaction.id}-${reason}`}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>

        {auditMode ? (
          <>
            <JsonPreview label="Selected Labels" value={transaction.selectedLabels ?? meta.selectedLabels ?? {}} />
            <JsonPreview label="Query Params" value={meta.queryParams ?? {}} />
            <JsonPreview label="Original Source Row" value={transaction.raw ?? {}} />
          </>
        ) : (
          <div className="rounded-[1.2rem] border border-outline-variant/15 bg-surface-container-low p-4 text-sm leading-6 text-on-surface-variant">
            Detailed source values are available in Audit Mode.
          </div>
        )}
      </div>
    </Card>
  )
}
