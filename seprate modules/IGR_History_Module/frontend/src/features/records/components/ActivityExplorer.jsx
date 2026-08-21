import { useEffect, useState } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';
import { TransactionNode } from '@/features/records/components/TransactionNode';

function ExplorerFilterField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d778a]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[1rem] border border-[#d9e2ef] bg-white px-3 py-3 text-sm text-[#152135] outline-none transition-colors focus:border-[#6b85a4]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FiltersContent({
  selectedYear,
  setSelectedYear,
  selectedType,
  setSelectedType,
  selectedOwner,
  setSelectedOwner,
  typeOptions,
  yearOptions,
  ownerOptions
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <ExplorerFilterField
        label="Year"
        value={selectedYear}
        onChange={setSelectedYear}
        options={[{ value: 'all', label: 'All years' }, ...yearOptions.map((year) => ({ value: year, label: year }))]}
      />
      <ExplorerFilterField
        label="Transaction Type"
        value={selectedType}
        onChange={setSelectedType}
        options={[{ value: 'all', label: 'All transaction types' }, ...typeOptions.map((type) => ({ value: type, label: type }))]}
      />
      <ExplorerFilterField
        label="Owner"
        value={selectedOwner}
        onChange={setSelectedOwner}
        options={[{ value: 'all', label: 'All owners' }, ...ownerOptions.map((owner) => ({ value: owner, label: owner }))]}
      />
    </div>
  );
}

export function ActivityExplorer({
  yearGroups,
  selectedYear,
  setSelectedYear,
  selectedType,
  setSelectedType,
  selectedOwner,
  setSelectedOwner,
  typeOptions,
  yearOptions,
  ownerOptions,
  selectedTransactionId,
  onSelectTransaction
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState({});
  const yearGroupSignature = yearGroups.map((group) => `${group.id}:${group.transactions.length}:${group.status}`).join('|');

  useEffect(() => {
    const next = {};
    yearGroups.slice(0, 2).forEach((group) => {
      next[group.id] = true;
    });
    setExpandedYears(next);
  }, [yearGroupSignature]);

  return (
    <Card className="border border-[#d9e2ef] bg-white p-6 shadow-[0_18px_40px_rgba(19,32,51,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6c778a]">Registry Activity Explorer</p>
          <h3 className="mt-2 font-document text-[1.95rem] font-semibold leading-none text-[#122033]">Explore activity by year, type, and party</h3>
          <p className="mt-3 text-sm leading-7 text-[#5f6c80]">
            Filter the surfaced registry history without losing year-level status, empty-year visibility, or failed run context.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="inline-flex items-center gap-2 self-start rounded-full border border-[#dfe7f1] bg-[#f5f8fc] px-4 py-2 text-sm font-semibold text-[#28435f] md:hidden"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
      </div>

      <div className="mt-6 hidden md:block">
        <FiltersContent
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          selectedOwner={selectedOwner}
          setSelectedOwner={setSelectedOwner}
          typeOptions={typeOptions}
          yearOptions={yearOptions}
          ownerOptions={ownerOptions}
        />
      </div>

      <div className="mt-6 space-y-4">
        {yearGroups.map((group) => {
          const isExpanded = expandedYears[group.id];
          return (
            <section key={group.id} className="overflow-hidden rounded-[1.45rem] border border-[#e2e9f2] bg-[#fbfdff]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => setExpandedYears((current) => ({ ...current, [group.id]: !current[group.id] }))}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#203146] px-3 py-1 text-xs font-semibold text-white">{group.year}</span>
                    <span className="rounded-full bg-[#eef2f7] px-3 py-1 text-xs font-semibold text-[#48586e]">
                      {group.transactionCount} surfaced record{group.transactionCount === 1 ? '' : 's'}
                    </span>
                    <span className="rounded-full bg-[#edf2f8] px-3 py-1 text-xs font-semibold text-[#32516f]">{group.status}</span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[#5f6c80]">{group.note}</p>
                </div>
                <ChevronDown className={cn('h-5 w-5 text-[#6f7b8f] transition-transform', isExpanded && 'rotate-180')} />
              </button>

              {isExpanded ? (
                <div className="space-y-3 border-t border-[#e7edf5] px-4 py-4">
                  {group.transactions.length > 0 ? (
                    group.transactions.map((transaction, index) => (
                      <TransactionNode
                        key={`${group.id}-${transaction.id}`}
                        transaction={transaction}
                        isActive={selectedTransactionId === transaction.id}
                        onSelect={() => onSelectTransaction(transaction)}
                        showConnector={index < group.transactions.length - 1}
                        compact
                      />
                    ))
                  ) : (
                    <div className="rounded-[1.2rem] border border-dashed border-[#d7e1ed] bg-[#f8fbff] px-4 py-6 text-sm leading-7 text-[#5f6c80]">
                      {group.note}
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[#122033]/36 px-3 pb-3 backdrop-blur-sm md:hidden">
          <div className="w-full rounded-[1.8rem] border border-[#dbe3ef] bg-[#f8fbff] p-5 shadow-[0_30px_80px_rgba(20,31,49,0.2)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6c778a]">Filters</p>
                <h4 className="mt-2 font-document text-[1.75rem] font-semibold text-[#122033]">Registry Activity Explorer</h4>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-full border border-[#d9e2ef] p-2 text-[#68788e]"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <FiltersContent
                selectedYear={selectedYear}
                setSelectedYear={setSelectedYear}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                selectedOwner={selectedOwner}
                setSelectedOwner={setSelectedOwner}
                typeOptions={typeOptions}
                yearOptions={yearOptions}
                ownerOptions={ownerOptions}
              />
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
