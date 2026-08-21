import { useState } from 'react'
import { ArrowDownAZ, ArrowUpAZ, Filter, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

function FilterField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field-shell mt-2">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function YearIndicator({ group }) {
  const toneClass =
    group.status === 'failed'
      ? 'bg-error-container/60 text-on-error-container'
      : group.transactionCount === 0
        ? 'bg-surface-container text-on-surface-variant'
        : 'bg-primary-fixed/70 text-primary'

  return (
    <div className="rounded-[1rem] border border-outline-variant/15 bg-surface-container-lowest/82 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-primary">{group.year}</span>
        <span className={cn('rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]', toneClass)}>
          {group.status}
        </span>
      </div>
      <p className="mt-3 text-sm text-on-surface-variant">
        {group.transactionCount} visible row{group.transactionCount === 1 ? '' : 's'}
      </p>
    </div>
  )
}

function MobileTransactionCard({ transaction, isSelected, onSelect }) {
  const toneClass =
    transaction.suspiciousLevel === 'high'
      ? 'border-error/30 bg-error-container/35'
      : transaction.suspiciousLevel === 'medium'
        ? 'border-primary-fixed/50 bg-primary-fixed/18'
        : 'border-outline-variant/15 bg-surface-container-lowest/82'

  return (
    <button
      type="button"
      onClick={() => onSelect(transaction)}
      className={cn(
        'w-full rounded-[1.35rem] border p-4 text-left transition hover:border-primary/30',
        toneClass,
        isSelected && 'border-primary/35 shadow-[0_14px_28px_rgba(3,22,50,0.08)]'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          {transaction.dateLabel}
        </span>
        <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
          {transaction.type}
        </span>
        <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
          {transaction.legalLinkageStatus}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">From</p>
          <p className="mt-1 text-sm font-semibold text-primary">{transaction.seller}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">To</p>
          <p className="mt-1 text-sm font-semibold text-primary">{transaction.buyer}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-on-surface-variant">
        <span className="rounded-full bg-surface-container px-3 py-1.5">{transaction.considerationLabel}</span>
        <span className="rounded-full bg-surface-container px-3 py-1.5">{transaction.areaLabel}</span>
        <span className="rounded-full bg-surface-container px-3 py-1.5">{transaction.surveyReferenceLabel}</span>
      </div>
    </button>
  )
}

function FiltersPanel({
  selectedYear,
  setSelectedYear,
  selectedType,
  setSelectedType,
  selectedOwner,
  setSelectedOwner,
  selectedSort,
  setSelectedSort,
  typeOptions,
  yearOptions,
  ownerOptions
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <FilterField
        label="Year"
        value={selectedYear}
        onChange={setSelectedYear}
        options={[{ value: 'all', label: 'All years' }, ...yearOptions.map((year) => ({ value: year, label: year }))]}
      />
      <FilterField
        label="Transaction Type"
        value={selectedType}
        onChange={setSelectedType}
        options={[{ value: 'all', label: 'All transaction types' }, ...typeOptions.map((type) => ({ value: type, label: type }))]}
      />
      <FilterField
        label="Owner"
        value={selectedOwner}
        onChange={setSelectedOwner}
        options={[{ value: 'all', label: 'All owners' }, ...ownerOptions.map((owner) => ({ value: owner, label: owner }))]}
      />
      <FilterField
        label="Sort"
        value={selectedSort}
        onChange={setSelectedSort}
        options={[
          { value: 'latest', label: 'Latest first' },
          { value: 'earliest', label: 'Earliest first' },
          { value: 'amount-desc', label: 'Highest consideration' },
          { value: 'amount-asc', label: 'Lowest consideration' }
        ]}
      />
    </div>
  )
}

export function TransactionForensicsTable({
  transactions,
  yearGroups,
  selectedTransactionId,
  onSelectTransaction,
  selectedYear,
  setSelectedYear,
  selectedType,
  setSelectedType,
  selectedOwner,
  setSelectedOwner,
  selectedSort,
  setSelectedSort,
  searchTerm,
  setSearchTerm,
  typeOptions,
  yearOptions,
  ownerOptions,
  hasActiveFilters,
  onClearFilters
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  return (
    <Card className="overflow-hidden border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(242,244,246,0.94))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="section-eyebrow">Transaction Forensics</p>
          <h2 className="mt-2 font-document text-[2rem] font-semibold leading-none text-primary">Registry ledger with investigative controls</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
            Search, filter, and sort live registry rows without losing property-linkage status, suspicious signals, or year-level workflow context.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {transactions.length} visible row{transactions.length === 1 ? '' : 's'}
          </div>
          <Button variant="secondary" className="lg:hidden" onClick={() => setMobileFiltersOpen(true)}>
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Search registry evidence</span>
          <div className="field-shell mt-2 flex items-center gap-3 bg-white">
            <Search className="h-4 w-4 text-on-surface-variant" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Seller, buyer, deed type, survey reference, amount, year"
              className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-on-surface-variant"
            />
          </div>
        </label>

        <div className="hidden lg:block">
          <FiltersPanel
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            selectedOwner={selectedOwner}
            setSelectedOwner={setSelectedOwner}
            selectedSort={selectedSort}
            setSelectedSort={setSelectedSort}
            typeOptions={typeOptions}
            yearOptions={yearOptions}
            ownerOptions={ownerOptions}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {yearGroups.map((group) => (
          <YearIndicator key={group.id} group={group} />
        ))}
      </div>

      {hasActiveFilters ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[1.1rem] border border-outline-variant/15 bg-surface-container-low px-4 py-3">
          <span className="text-sm text-on-surface-variant">Filtered forensic view is active.</span>
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}

      <div className="mt-6 hidden overflow-hidden rounded-[1.4rem] border border-outline-variant/15 lg:block">
        <div className="max-h-[32rem] overflow-auto">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-surface-container-lowest/95 backdrop-blur">
              <tr className="text-left">
                {['Date', 'Registry Event Parties', 'Type', 'Consideration', 'Area', 'Survey Reference', 'Legal Linkage', 'Action'].map((label) => (
                  <th
                    key={label}
                    className="border-b border-outline-variant/15 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((transaction) => {
                  const rowTone =
                    transaction.suspiciousLevel === 'high'
                      ? 'bg-error-container/22'
                      : transaction.suspiciousLevel === 'medium'
                        ? 'bg-primary-fixed/12'
                        : 'bg-transparent'

                  return (
                    <tr
                      key={transaction.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectTransaction(transaction)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelectTransaction(transaction)
                        }
                      }}
                      className={cn(
                        'cursor-pointer transition hover:bg-surface-container-low',
                        rowTone,
                        selectedTransactionId === transaction.id && 'bg-primary-fixed/18'
                      )}
                    >
                      <td className="border-b border-outline-variant/10 px-4 py-4 text-sm font-semibold text-primary">
                        <div>{transaction.dateLabel}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.14em] text-on-surface-variant">
                          Source year {transaction.sourceYear}
                        </div>
                      </td>
                      <td className="border-b border-outline-variant/10 px-4 py-4 text-sm text-on-surface-variant">
                        <div className="font-semibold text-primary">{transaction.seller}</div>
                        <div className="my-1 text-xs uppercase tracking-[0.14em] text-on-surface-variant">to</div>
                        <div className="font-semibold text-primary">{transaction.buyer}</div>
                      </td>
                      <td className="border-b border-outline-variant/10 px-4 py-4 text-sm text-primary">{transaction.type}</td>
                      <td className="border-b border-outline-variant/10 px-4 py-4 text-sm text-on-surface-variant">
                        {transaction.considerationLabel}
                      </td>
                      <td className="border-b border-outline-variant/10 px-4 py-4 text-sm text-on-surface-variant">{transaction.areaLabel}</td>
                      <td className="border-b border-outline-variant/10 px-4 py-4 text-sm text-on-surface-variant">
                        {transaction.surveyReferenceLabel}
                      </td>
                      <td className="border-b border-outline-variant/10 px-4 py-4">
                        <div className="inline-flex rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                          {transaction.legalLinkageStatus}
                        </div>
                      </td>
                      <td className="border-b border-outline-variant/10 px-4 py-4">
                        <Button variant="ghost" size="sm" className="w-full">
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-on-surface-variant">
                    No registry rows match the current filters. Clear the forensic filters or inspect the technical payload below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 space-y-3 lg:hidden">
        {transactions.length > 0 ? (
          transactions.map((transaction) => (
            <MobileTransactionCard
              key={transaction.id}
              transaction={transaction}
              isSelected={selectedTransactionId === transaction.id}
              onSelect={onSelectTransaction}
            />
          ))
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-outline-variant/20 bg-surface-container-low p-5 text-sm leading-7 text-on-surface-variant">
            No registry rows match the current filters. Clear the filters or review the raw payload explorer for source coverage details.
          </div>
        )}
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(3,22,50,0.34)] px-3 pb-3 backdrop-blur-sm lg:hidden">
          <div className="w-full rounded-[1.8rem] border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-[0_30px_80px_rgba(3,22,50,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow">Forensic Filters</p>
                <h3 className="mt-2 font-document text-[1.8rem] font-semibold text-primary">Refine registry evidence</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full border border-outline-variant/20 p-2 text-on-surface-variant"
                aria-label="Close forensic filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5">
              <FiltersPanel
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                selectedOwner={selectedOwner}
                setSelectedOwner={setSelectedOwner}
                selectedSort={selectedSort}
                setSelectedSort={setSelectedSort}
                typeOptions={typeOptions}
                yearOptions={yearOptions}
                ownerOptions={ownerOptions}
              />
            </div>
            <div className="mt-5 flex justify-between gap-3">
              <Button variant="ghost" onClick={onClearFilters}>
                Clear
              </Button>
              <Button onClick={() => setMobileFiltersOpen(false)}>
                Apply filters
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
