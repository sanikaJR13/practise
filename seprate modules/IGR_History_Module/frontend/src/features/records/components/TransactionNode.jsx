import { ArrowDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const TRANSACTION_STYLES = {
  'Sale Deed': 'bg-primary text-on-primary',
  'Gift Deed': 'bg-primary-fixed/75 text-primary',
  Mortgage: 'bg-error-container text-on-error-container',
  'Release Deed': 'bg-surface-container text-primary',
  Encumbrance: 'bg-error-container/70 text-on-error-container',
  Conveyance: 'bg-surface-container text-primary',
  Partition: 'bg-surface-container text-primary',
  'Registry Entry': 'bg-surface-container text-primary'
}

const MATCH_STYLES = {
  exact: 'bg-tertiary-fixed/35 text-on-tertiary-fixed',
  partial: 'bg-primary-fixed/75 text-primary',
  ambiguous: 'bg-error-container/55 text-on-error-container',
  unmatched: 'bg-error-container text-on-error-container'
}

export function TransactionNode({ transaction, isActive, onSelect, showConnector, compact = false }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'group flex w-full items-start gap-4 rounded-[1.5rem] border px-4 py-4 text-left transition-all duration-200 sm:px-5',
          isActive
            ? 'border-primary/25 bg-primary-fixed/18 shadow-[0_18px_34px_rgba(3,22,50,0.08)]'
            : 'border-outline-variant/15 bg-surface-container-lowest/88 hover:border-primary/20 hover:bg-white'
        )}
      >
        <div className="flex flex-col items-center">
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full border text-xs font-semibold',
              isActive
                ? 'border-primary/20 bg-primary text-on-primary'
                : 'border-outline-variant/15 bg-surface-container text-primary'
            )}
          >
            {transaction.sequenceNumber}
          </div>
          {showConnector ? <div className="mt-2 h-14 w-px bg-outline-variant/30" /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]',
                TRANSACTION_STYLES[transaction.type] ?? TRANSACTION_STYLES['Registry Entry']
              )}
            >
              {transaction.type}
            </span>
            <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              {transaction.dateLabel}
            </span>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]',
                MATCH_STYLES[transaction.matchStatus] ?? MATCH_STYLES.ambiguous
              )}
            >
              {transaction.legalLinkageStatus}
            </span>
          </div>

          <div className={cn('mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr]', compact && 'md:grid-cols-1')}>
            <div className="rounded-[1rem] border border-outline-variant/15 bg-surface-container-low px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">From</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-primary">{transaction.seller}</p>
            </div>
            {!compact ? (
              <div className="hidden items-center justify-center md:flex">
                <ArrowDown className="h-4 w-4 text-on-surface-variant" />
              </div>
            ) : null}
            <div className="rounded-[1rem] border border-outline-variant/15 bg-surface-container-low px-3 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">To</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-primary">{transaction.buyer}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm text-on-surface-variant">
            <span className="rounded-full bg-surface-container px-3 py-1.5">{transaction.considerationLabel}</span>
            <span className="rounded-full bg-surface-container px-3 py-1.5">{transaction.areaLabel}</span>
            <span className="rounded-full bg-surface-container px-3 py-1.5">{transaction.surveyReferenceLabel}</span>
            {transaction.suspiciousCount > 0 ? (
              <span className="rounded-full bg-error-container/60 px-3 py-1.5 text-on-error-container">
                {transaction.suspiciousCount} review signal{transaction.suspiciousCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        </div>

        <ChevronRight className={cn('mt-2 h-5 w-5 flex-shrink-0 text-on-surface-variant transition-transform', isActive && 'rotate-90')} />
      </button>
    </div>
  )
}
