import { ArrowRight, CheckCircle2, MapPinned } from 'lucide-react'
import { Card } from '@/components/ui/Card'

function TrailNode({ step, showConnector }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="rounded-2xl bg-primary-fixed/70 p-3 text-primary">
        <MapPinned className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 rounded-[1.2rem] border border-outline-variant/15 bg-surface-container-lowest/80 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{step.label}</p>
          {step.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed/35 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-on-tertiary-fixed">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-base font-semibold text-primary">{step.readableLabel}</p>
        <div className="mt-3 grid gap-2 text-sm text-on-surface-variant sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Submitted source value</p>
            <p className="mt-1">{step.sourceValue}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Response label</p>
            <p className="mt-1">{step.responseLabel}</p>
          </div>
        </div>
      </div>
      {showConnector ? <ArrowRight className="hidden h-4 w-4 flex-shrink-0 text-on-surface-variant md:block" /> : null}
    </div>
  )
}

export function LocationResolutionTrail({ locationVerification }) {
  return (
    <Card className="overflow-hidden border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,244,246,0.92))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-eyebrow">Location Verification Chain</p>
          <h2 className="mt-2 font-document text-[2rem] font-semibold leading-none text-primary">District to village resolution trail</h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-on-surface-variant">{locationVerification.summary}</p>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {locationVerification.steps.map((step, index) => (
          <TrailNode
            key={step.id}
            step={step}
            showConnector={index < locationVerification.steps.length - 1}
          />
        ))}
      </div>
    </Card>
  )
}
