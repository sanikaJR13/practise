import { FileSearch } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { TransactionNode } from '@/features/records/components/TransactionNode'

function YearSeparator({ year }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="h-px flex-1 bg-outline-variant/20" />
      <div className="rounded-full bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-on-surface-variant">
        {year}
      </div>
      <div className="h-px flex-1 bg-outline-variant/20" />
    </div>
  )
}

export function OwnershipTimeline({ transactions, selectedTransactionId, onSelectTransaction, yearGroups }) {
  return (
    <Card className="border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(242,244,246,0.94))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)] sm:p-7">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">Transaction Indicator Timeline</p>
          <h2 className="mt-2 font-document text-[2rem] font-semibold leading-none text-primary">Chronology of visible registry events</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
            The timeline converts raw registry rows into readable event indicators so users can inspect coverage, survey linkage, and party references before reading technical metadata. It does not prove title continuity.
          </p>
        </div>
        <div className="rounded-full border border-outline-variant/15 bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
          {transactions.length} surfaced event{transactions.length === 1 ? '' : 's'}
        </div>
      </div>

      {transactions.length > 0 ? (
        <div className="mt-6 space-y-0">
          {transactions.map((transaction, index) => {
            const previousTransaction = index > 0 ? transactions[index - 1] : null
            const needsYearSeparator = index === 0 || previousTransaction?.year !== transaction.year

            return (
              <div key={transaction.id}>
                {needsYearSeparator ? <YearSeparator year={transaction.year} /> : null}
                <TransactionNode
                  transaction={transaction}
                  isActive={selectedTransactionId === transaction.id}
                  onSelect={() => onSelectTransaction(transaction)}
                  showConnector={index < transactions.length - 1}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-5 py-10 text-center">
          <FileSearch className="mx-auto h-8 w-8 text-on-surface-variant" />
          <h3 className="mt-4 text-lg font-semibold text-primary">No chronology could be assembled</h3>
          <p className="mt-2 text-sm leading-7 text-on-surface-variant">
            The page still preserves year-level coverage, raw payload inspection, and source-run context even when individual registry rows are missing.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {yearGroups.map((group) => (
              <span key={group.id} className="rounded-full border border-outline-variant/15 bg-surface-container-lowest px-3 py-2 text-xs font-semibold text-on-surface-variant">
                {group.year}: {group.status}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
