import { Activity, CalendarClock, MapPinned, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

function PassportField({ icon: Icon, label, value, detail }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-full bg-[#edf2f8] p-2 text-[#29425f]">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6d778a]">{label}</p>
        <p className="mt-2 text-base font-semibold leading-6 text-[#132033]">{value}</p>
        {detail ? <p className="mt-1 text-sm leading-6 text-[#5f6c80]">{detail}</p> : null}
      </div>
    </div>
  );
}

export function PropertyPassport({ passport, status, sampleOnly }) {
  return (
    <Card className="overflow-hidden border border-[#d9e2ef] bg-white p-0 shadow-[0_18px_40px_rgba(19,32,51,0.06)]">
      <div className="border-b border-[#e7edf5] px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6c778a]">Property Registration Passport</p>
            <h1 className="mt-3 font-document text-[2.3rem] font-semibold leading-none text-[#122033] sm:text-[2.75rem]">
              Survey {passport.surveyNumber}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6c80]">
              A calm registry identity layer built from surfaced IGR evidence, transaction indicator rows, and year-level execution status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[#e9eef7] text-[#1d3552]" tone="neutral">
              {status}
            </Badge>
            <Badge className="bg-[#eef2f7] text-[#435067]" tone="neutral">
              {passport.transactionCount} transaction{passport.transactionCount === 1 ? '' : 's'}
            </Badge>
            {sampleOnly ? (
              <Badge className="bg-[#fff4e4] text-[#865821]" tone="neutral">
                Sampled year summaries
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:px-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6 md:grid-cols-2">
          <PassportField
            icon={MapPinned}
            label="Survey / Hissa"
            value={`Survey ${passport.surveyNumber}`}
            detail={`Hissa ${passport.hissaNumber}`}
          />
          <PassportField
            icon={MapPinned}
            label="Location"
            value={`${passport.village}, ${passport.taluka}`}
            detail={passport.district}
          />
          <PassportField
            icon={UserRound}
            label="Current Owner"
            value={passport.currentOwner}
            detail="Derived from the latest visible buyer or canonical extracted owner."
          />
          <PassportField
            icon={CalendarClock}
            label="Last Transaction Date"
            value={passport.lastTransactionDate}
            detail={passport.latestTransactionType}
          />
        </div>

        <div className="grid gap-4 rounded-[1.5rem] border border-[#e7edf5] bg-[#f8fbff] p-5 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-[1.2rem] bg-[#eef2f7] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e798b]">Registry Activity Span</p>
            <p className="mt-3 text-xl font-semibold text-[#132033]">{passport.activitySpan}</p>
          </div>
          <div className="rounded-[1.2rem] bg-[#ebf2f8] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#607186]">Current Area</p>
            <p className="mt-3 text-xl font-semibold text-[#1f466b]">{passport.currentArea}</p>
          </div>
          <div className="rounded-[1.2rem] bg-[#f6f8fb] p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-white p-2 text-[#52657d]">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e798b]">Activity Snapshot</p>
                <p className="mt-2 text-base font-semibold text-[#132033]">{passport.transactionCount} surfaced event{passport.transactionCount === 1 ? '' : 's'}</p>
                <p className="mt-1 text-sm text-[#5f6c80]">{passport.latestTransactionType}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
