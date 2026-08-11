import { ArrowUpRight, Download, Fingerprint, MapPinned, ScanSearch, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { WorkflowStatusBadge } from '@/features/records/components/WorkflowStatusBadge'

function HeroMetric({ label, value, detail, accent = 'default' }) {
  const accentClass =
    accent === 'strong'
      ? 'bg-primary text-on-primary'
      : accent === 'soft'
        ? 'bg-primary-fixed/60 text-primary'
        : 'bg-surface-container-lowest/70 text-primary'

  return (
    <div className="glass-panel rounded-[1.35rem] border border-outline-variant/20 p-4 shadow-[0_14px_28px_rgba(3,22,50,0.06)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${accentClass}`}>{value}</div>
      {detail ? <p className="mt-3 text-sm leading-6 text-on-surface-variant">{detail}</p> : null}
    </div>
  )
}

function HeroStat({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-[1.25rem] border border-outline-variant/15 bg-surface-container-lowest/72 p-4 shadow-[0_10px_24px_rgba(3,22,50,0.04)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary-fixed/70 p-3 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{label}</p>
          <p className="mt-2 text-base font-semibold text-primary">{value}</p>
          {detail ? <p className="mt-2 text-sm leading-6 text-on-surface-variant">{detail}</p> : null}
        </div>
      </div>
    </div>
  )
}

function ScoreRow({ label, value, tone = 'primary' }) {
  const fillClass =
    tone === 'warning'
      ? 'bg-[linear-gradient(90deg,rgba(186,26,26,0.82),rgba(255,218,214,0.95))]'
      : 'bg-[linear-gradient(90deg,rgba(3,22,50,0.92),rgba(182,199,235,0.95))]'

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-on-surface-variant">{label}</span>
        <span className="font-semibold text-primary">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

export function PropertyIdentityHero({ hero, technical, matchConfidence, onExportJson, workflowRoute }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-outline-variant/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(236,238,240,0.88)_58%,rgba(215,226,255,0.72))] p-6 shadow-[0_30px_80px_rgba(3,22,50,0.09)] sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(215,226,255,0.65),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(111,251,190,0.12),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(3,22,50,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(3,22,50,0.12)_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="relative space-y-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">
              <span>Records</span>
              <span>/</span>
              <span>IGR History</span>
              <span>/</span>
              <span>{hero.district}</span>
              <span>/</span>
              <span className="text-primary">Survey {hero.surveyNumber}</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <WorkflowStatusBadge status={hero.workflowStatus} />
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                {hero.sourceAuthenticity}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                <ScanSearch className="h-3.5 w-3.5" />
                {hero.ocrStatus}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                <Fingerprint className="h-3.5 w-3.5" />
                Source run #{hero.sourceRunId}
              </div>
            </div>

            <h1 className="mt-6 font-document text-[2.7rem] font-semibold leading-none text-primary sm:text-[3.4rem]">
              Evidence-linked historical registry intelligence
            </h1>
            <p className="mt-5 max-w-3xl text-sm leading-8 text-on-surface-variant">
              This page turns the existing IGR source-run payload into a readable transaction-indicator explorer. The system preserves raw registry evidence, explains location resolution, and highlights where property linkage needs review.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {workflowRoute ? (
              <Link to={workflowRoute}>
                <Button variant="secondary">
                  <ArrowUpRight className="h-4 w-4" />
                  Open workflow
                </Button>
              </Link>
            ) : null}
            <Button onClick={onExportJson}>
              <Download className="h-4 w-4" />
              Export source JSON
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HeroStat
            icon={MapPinned}
            label="Survey / Property"
            value={`Survey ${hero.surveyNumber}`}
            detail={`Property ${hero.propertyNumber} / Hissa ${hero.hissaNumber}`}
          />
          <HeroStat
            icon={MapPinned}
            label="Location"
            value={`${hero.village}, ${hero.taluka}`}
            detail={hero.district}
          />
          <HeroStat
            icon={UserRound}
            label="Extracted Owner Signal"
            value={hero.currentOwner}
            detail={`Latest visible IGR event: ${hero.latestTransactionType}`}
          />
          <HeroStat
            icon={ShieldCheck}
            label="Workflow Scope"
            value={`${hero.transactionCount} transaction${hero.transactionCount === 1 ? '' : 's'}`}
            detail={`Year scope ${hero.yearScope}`}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-4 md:grid-cols-3">
            <HeroMetric
              label="Workflow State"
              value={hero.completionState}
              detail={`Retrieved ${hero.retrievalTimestamp}`}
              accent={hero.workflowStatus === 'completed' ? 'strong' : 'soft'}
            />
            <HeroMetric
              label="Match Confidence"
              value={`${matchConfidence.label}`}
              detail={`${matchConfidence.overallScore}% property linkage confidence`}
              accent="soft"
            />
            <HeroMetric
              label="Registry Risk Signals"
              value={`${hero.suspiciousCount} flagged`}
              detail={hero.hasIncompleteYears ? 'Year coverage is incomplete.' : 'No missing year coverage surfaced.'}
            />
          </div>

          <div className="glass-panel rounded-[1.4rem] border border-outline-variant/20 p-5 shadow-[0_14px_28px_rgba(3,22,50,0.06)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Confidence Indicators</p>
            <div className="mt-4 space-y-4">
              <ScoreRow label="Property match confidence" value={matchConfidence.overallScore} />
              <ScoreRow
                label="Metadata completeness"
                value={technical.metadataCompleteness}
                tone={technical.metadataCompleteness < 60 ? 'warning' : 'primary'}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1rem] bg-surface-container-low px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Scraper Run</p>
                <p className="mt-2 text-sm font-semibold text-primary">{hero.scraperRunId}</p>
              </div>
              <div className="rounded-[1rem] bg-surface-container-low px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Workflow Run</p>
                <p className="mt-2 text-sm font-semibold text-primary">#{hero.workflowRunId}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
