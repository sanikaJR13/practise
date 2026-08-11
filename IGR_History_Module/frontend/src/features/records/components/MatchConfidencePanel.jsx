import { Crosshair, MinusCircle, ScanSearch, ShieldQuestion, Target } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

const STATUS_STYLES = {
  exact: {
    label: 'Exact',
    icon: Target,
    pill: 'bg-tertiary-fixed/35 text-on-tertiary-fixed',
    text: 'text-primary'
  },
  partial: {
    label: 'Partial',
    icon: Crosshair,
    pill: 'bg-primary-fixed/70 text-primary',
    text: 'text-primary'
  },
  ambiguous: {
    label: 'Ambiguous',
    icon: ShieldQuestion,
    pill: 'bg-error-container/55 text-on-error-container',
    text: 'text-on-surface'
  },
  unmatched: {
    label: 'Mismatch',
    icon: MinusCircle,
    pill: 'bg-error-container text-on-error-container',
    text: 'text-on-surface'
  }
}

function CountCard({ label, value }) {
  return (
    <div className="rounded-[1.15rem] border border-outline-variant/15 bg-surface-container-lowest/82 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-primary">{value}</p>
    </div>
  )
}

export function MatchConfidencePanel({ matchConfidence }) {
  return (
    <Card className="overflow-hidden border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,244,246,0.92))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="section-eyebrow">Property Match Confidence</p>
          <h2 className="mt-2 font-document text-[2rem] font-semibold leading-none text-primary">How strongly these rows match the queried property</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">{matchConfidence.summary}</p>
        </div>
        <div className="rounded-[1.25rem] border border-outline-variant/15 bg-surface-container-lowest/82 px-4 py-3 text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Overall confidence</p>
          <p className="mt-2 text-2xl font-semibold text-primary">{matchConfidence.overallScore}%</p>
          <p className="mt-1 text-sm text-on-surface-variant">{matchConfidence.label}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-full bg-surface-container">
        <div
          className="h-3 rounded-full bg-[linear-gradient(90deg,rgba(3,22,50,0.92),rgba(182,199,235,0.95),rgba(111,251,190,0.75))]"
          style={{ width: `${Math.max(0, Math.min(100, matchConfidence.overallScore))}%` }}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CountCard label="Exact survey matches" value={matchConfidence.exactCount} />
        <CountCard label="Partial survey matches" value={matchConfidence.partialCount} />
        <CountCard label="Ambiguous rows" value={matchConfidence.ambiguousCount} />
        <CountCard label="Survey mismatches" value={matchConfidence.unmatchedCount} />
      </div>

      <div className="mt-6 rounded-[1.25rem] border border-outline-variant/15 bg-surface-container-low p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Matched property reference</p>
        <p className="mt-2 text-base font-semibold text-primary">{matchConfidence.queryReference.displayLabel}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {matchConfidence.matchedKeywords.length > 0 ? (
            matchConfidence.matchedKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-primary"
              >
                <ScanSearch className="h-3.5 w-3.5" />
                {keyword}
              </span>
            ))
          ) : (
            <span className="rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-on-surface-variant">
              No direct property keywords surfaced
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {matchConfidence.rows.slice(0, 4).map((row) => {
          const statusConfig = STATUS_STYLES[row.status] ?? STATUS_STYLES.ambiguous
          const Icon = statusConfig.icon

          return (
            <div
              key={row.id}
              className="rounded-[1.15rem] border border-outline-variant/15 bg-surface-container-lowest/82 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]', statusConfig.pill)}>
                      <Icon className="h-3.5 w-3.5" />
                      {statusConfig.label}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                      {row.score}% score
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-primary">{row.label}</p>
                  <p className="mt-2 text-sm leading-7 text-on-surface-variant">{row.explanation}</p>
                </div>
                <div className="rounded-[1rem] bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
                  {row.surveyReference}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
