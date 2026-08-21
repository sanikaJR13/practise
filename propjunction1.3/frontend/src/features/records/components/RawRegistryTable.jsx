import { Database, FileJson } from 'lucide-react';
import { Card } from '@/components/ui/Card';

function RawCard({ transaction, onSelect }) {
  return (
    <div className="rounded-[1.3rem] border border-[#dfe7f1] bg-white/92 p-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#152135]">{transaction.type}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#6c778a]">{transaction.dateLabel}</p>
        </div>
        <button type="button" onClick={onSelect} className="rounded-full bg-[#edf2f8] px-3 py-1.5 text-xs font-semibold text-[#29425f]">
          Evidence
        </button>
      </div>
      <div className="mt-3 space-y-2 text-sm text-[#5f6c80]">
        <p><span className="font-semibold text-[#152135]">From:</span> {transaction.seller}</p>
        <p><span className="font-semibold text-[#152135]">To:</span> {transaction.buyer}</p>
        <p><span className="font-semibold text-[#152135]">Area:</span> {transaction.areaLabel}</p>
        <p><span className="font-semibold text-[#152135]">Description:</span> {transaction.propertyDescription}</p>
      </div>
    </div>
  );
}

export function RawRegistryTable({ transactions, onSelectTransaction }) {
  return (
    <Card className="border border-[#d9e2ef] bg-white p-6 shadow-[0_18px_40px_rgba(19,32,51,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6c778a]">Raw Registry Records</p>
          <h3 className="mt-2 font-document text-[1.9rem] font-semibold leading-none text-[#122033]">Original rows stay visible</h3>
          <p className="mt-3 text-sm leading-7 text-[#5f6c80]">
            Raw transaction rows remain available as a secondary evidence layer so institutional users can inspect the original extracted values.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#dfe7f1] bg-[#f7faff] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#5b6980]">
          <Database className="h-4 w-4" />
          {transactions.length} raw row{transactions.length === 1 ? '' : 's'}
        </div>
      </div>

      {transactions.length > 0 ? (
        <>
          <div className="mt-6 space-y-3">
            {transactions.map((transaction) => (
              <RawCard key={`mobile-${transaction.id}`} transaction={transaction} onSelect={() => onSelectTransaction(transaction)} />
            ))}
          </div>

          <div className="mt-6 hidden overflow-auto rounded-[1.4rem] border border-[#dfe7f1] md:block">
            <table className="min-w-full border-collapse">
              <thead className="bg-[#f3f6fa]">
                <tr className="text-left">
                  {['Date', 'Type', 'Seller', 'Buyer', 'Area', 'Description', 'Source'].map((column) => (
                    <th key={column} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7a8e]">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7edf5] bg-white/92">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="align-top">
                    <td className="px-4 py-4 text-sm text-[#152135]">{transaction.dateLabel}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-[#152135]">{transaction.type}</td>
                    <td className="px-4 py-4 text-sm text-[#5f6c80]">{transaction.seller}</td>
                    <td className="px-4 py-4 text-sm text-[#5f6c80]">{transaction.buyer}</td>
                    <td className="px-4 py-4 text-sm text-[#152135]">{transaction.areaLabel}</td>
                    <td className="max-w-[24rem] px-4 py-4 text-sm leading-7 text-[#5f6c80]">{transaction.propertyDescription}</td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => onSelectTransaction(transaction)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#edf2f8] px-3 py-1.5 text-xs font-semibold text-[#29425f]"
                      >
                        <FileJson className="h-3.5 w-3.5" />
                        Evidence
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-[1.4rem] border border-dashed border-[#d7e1ed] bg-[#f8fbff] px-5 py-10 text-center text-sm leading-7 text-[#5f6c80]">
          No raw registry rows were available in this payload.
        </div>
      )}
    </Card>
  );
}
