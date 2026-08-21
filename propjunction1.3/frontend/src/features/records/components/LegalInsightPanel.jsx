import { useState } from 'react'
import { AlertTriangle, ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

const SEVERITY_STYLES = {
  high: {
    icon: ShieldAlert,
    chip: 'bg-error-container text-on-error-container',
    card: 'border-error/20 bg-error-container/22'
  },
  medium: {
    icon: AlertTriangle,
    chip: 'bg-primary-fixed/80 text-primary',
    card: 'border-primary-fixed/35 bg-primary-fixed/16'
  },
  low: {
    icon: ShieldCheck,
    chip: 'bg-tertiary-fixed/35 text-on-tertiary-fixed',
    card: 'border-outline-variant/15 bg-surface-container-lowest/82'
  }
}

export function LegalInsightPanel({ insights }) {
  const [expandedId, setExpandedId] = useState(insights[0]?.id ?? null)

  return (
    <Card className="overflow-hidden border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,244,246,0.92))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <div>
        <p className="section-eyebrow">Intelligent Legal Insights</p>
        <h2 className="mt-2 font-document text-[2rem] font-semibold leading-none text-primary">Frontend-derived registry signals</h2>
        <p className="mt-3 text-sm leading-7 text-on-surface-variant">
          These are UI-level observations derived from visible transaction structure and source coverage. They are designed to guide review, not replace legal conclusions.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {insights.map((insight) => {
          const style = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.low
          const Icon = style.icon
          const isOpen = expandedId === insight.id

          return (
            <section key={insight.id} className={cn('overflow-hidden rounded-[1.3rem] border', style.card)}>
              <button
                type="button"
                onClick={() => setExpandedId((current) => (current === insight.id ? null : insight.id))}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]', style.chip)}>
                      <Icon className="h-3.5 w-3.5" />
                      {insight.severity}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Impact-led review cue</span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-primary">{insight.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-on-surface-variant">{insight.impact}</p>
                </div>
                <ChevronDown className={cn('mt-1 h-5 w-5 flex-shrink-0 text-on-surface-variant transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen ? (
                <div className="border-t border-outline-variant/10 px-5 py-4">
                  <p className="text-sm leading-7 text-on-surface-variant">{insight.explanation}</p>
                  {insight.references?.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {insight.references.map((reference) => (
                        <span
                          key={`${insight.id}-${reference}`}
                          className="rounded-full bg-surface-container-lowest px-3 py-1 text-xs font-semibold text-primary"
                        >
                          {reference}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
    </Card>
  )
}
