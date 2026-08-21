import { useDeferredValue, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { QueryState } from '@/components/ui/QueryState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AuditModePanel } from '@/components/audit/AuditModePanel'
import { recordsService } from '@/features/records/api/recordsService'
import { JsonExplorer } from '@/features/records/components/JsonExplorer'
import { LegalInsightPanel } from '@/features/records/components/LegalInsightPanel'
import { LegalTermTooltip } from '@/features/records/components/LegalTermTooltip'
import { LocationResolutionTrail } from '@/features/records/components/LocationResolutionTrail'
import { MatchConfidencePanel } from '@/features/records/components/MatchConfidencePanel'
import { OwnershipTimeline } from '@/features/records/components/OwnershipTimeline'
import { PropertyIdentityHero } from '@/features/records/components/PropertyIdentityHero'
import { PropertyStory } from '@/features/records/components/PropertyStory'
import { SourceRunMetadataPanel } from '@/features/records/components/SourceRunMetadataPanel'
import { TransactionDrawer } from '@/features/records/components/TransactionDrawer'
import { TransactionForensicsTable } from '@/features/records/components/TransactionForensicsTable'
import { buildIgrHistoryViewModel } from '@/features/records/utils/normalizeIgrHistory'
import { useAuditMode } from '@/lib/audit-mode'
import { downloadJsonFile } from '@/lib/utils/actions'

function IgrLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[23rem] w-full rounded-[2rem]" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <Skeleton className="h-[40rem] w-full rounded-[2rem]" />
        <div className="space-y-6">
          <Skeleton className="h-[24rem] w-full rounded-[2rem]" />
          <Skeleton className="h-[18rem] w-full rounded-[2rem]" />
        </div>
      </div>
      <Skeleton className="h-[34rem] w-full rounded-[2rem]" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[18rem] w-full rounded-[2rem]" />
        <Skeleton className="h-[18rem] w-full rounded-[2rem]" />
      </div>
    </div>
  )
}

function matchesFilters(transaction, selectedType, selectedOwner, searchValue) {
  const typeMatch = selectedType === 'all' || transaction.type === selectedType
  const ownerMatch =
    selectedOwner === 'all' ||
    transaction.seller === selectedOwner ||
    transaction.buyer === selectedOwner
  const searchMatch =
    !searchValue ||
    [
      transaction.type,
      transaction.seller,
      transaction.buyer,
      transaction.areaLabel,
      transaction.considerationLabel,
      transaction.propertyDescription,
      transaction.dateLabel,
      transaction.surveyReferenceLabel,
      transaction.legalLinkageStatus,
      String(transaction.year)
    ]
      .join(' ')
      .toLowerCase()
      .includes(searchValue)

  return typeMatch && ownerMatch && searchMatch
}

function buildFilteredYearGroups(yearGroups, selectedYear, selectedType, selectedOwner, searchValue) {
  return yearGroups
    .filter((group) => selectedYear === 'all' || String(group.year) === selectedYear)
    .map((group) => {
      const transactions = group.transactions.filter((transaction) =>
        matchesFilters(transaction, selectedType, selectedOwner, searchValue)
      )

      return {
        ...group,
        transactions
      }
    })
    .filter((group) => {
      if (group.transactions.length > 0) {
        return true
      }

      if (group.status === 'failed' || group.transactionCount === 0) {
        return true
      }

      return false
    })
}

function sortTransactions(transactions, selectedSort) {
  const rows = [...transactions]

  if (selectedSort === 'earliest') {
    return rows.sort((left, right) => left.sortTime - right.sortTime)
  }

  if (selectedSort === 'amount-desc') {
    return rows.sort((left, right) => (right.considerationValue ?? -1) - (left.considerationValue ?? -1))
  }

  if (selectedSort === 'amount-asc') {
    return rows.sort((left, right) => (left.considerationValue ?? Number.MAX_SAFE_INTEGER) - (right.considerationValue ?? Number.MAX_SAFE_INTEGER))
  }

  return rows.sort((left, right) => right.sortTime - left.sortTime)
}

function CoverageNotice({ sourceIssues, hasSampleOnlyYears }) {
  if (sourceIssues.length === 0 && !hasSampleOnlyYears) {
    return null
  }

  return (
    <Card className="border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(242,244,246,0.94))] p-5 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-error-container/70 p-3 text-on-error-container">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <p className="section-eyebrow">Coverage Notes</p>
          <h2 className="mt-2 font-document text-[1.8rem] font-semibold leading-none text-primary">Some searched years need cautious interpretation</h2>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            {sourceIssues.length > 0
              ? `${sourceIssues.length} year bucket(s) are empty or failed in the visible payload, so the registry event sequence below should be treated as surfaced evidence rather than a complete legal conclusion.`
              : 'Some years are represented by sampled transactions only, so the page preserves the source-run details and raw explorer for audit review.'}
          </p>
        </div>
      </div>
    </Card>
  )
}

function LegalInterpreterSection({ terms }) {
  return (
    <Card className="border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,244,246,0.92))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="section-eyebrow">Legal Term Interpreter</p>
          <h2 className="mt-2 font-document text-[2rem] font-semibold leading-none text-primary">Registry language in plain English</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
            Short contextual explanations keep legal meaning close to the transaction chain without turning the page into a dense glossary.
          </p>
        </div>
        <div className="hidden rounded-full bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant sm:inline-flex">
          {terms.length} core terms
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {terms.map((term) => (
          <LegalTermTooltip
            key={term.term}
            term={term.term}
            meaning={term.meaning}
            significance={term.significance}
            practical={term.practical}
          />
        ))}
      </div>
    </Card>
  )
}

export function IgrHistoryPage() {
  const { propertyId = '' } = useParams()
  const auditMode = useAuditMode()
  const [selectedTransactionId, setSelectedTransactionId] = useState(null)
  const [selectedYear, setSelectedYear] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedOwner, setSelectedOwner] = useState('all')
  const [selectedSort, setSelectedSort] = useState('latest')
  const [searchTerm, setSearchTerm] = useState('')
  const [mobileEvidenceOpen, setMobileEvidenceOpen] = useState(false)
  const deferredSearchTerm = useDeferredValue(searchTerm)

  const igrQuery = useQuery({
    queryKey: ['records', 'igr-history', propertyId],
    enabled: Boolean(propertyId),
    queryFn: () => recordsService.getIgrHistory(propertyId)
  })

  return (
    <QueryState query={igrQuery} loading={<IgrLoading />} errorTitle="Unable to load IGR history">
      {igrQuery.data ? (
        <IgrHistoryExperience
          rawData={igrQuery.data}
          selectedTransactionId={selectedTransactionId}
          setSelectedTransactionId={setSelectedTransactionId}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          selectedOwner={selectedOwner}
          setSelectedOwner={setSelectedOwner}
          selectedSort={selectedSort}
          setSelectedSort={setSelectedSort}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          deferredSearchTerm={deferredSearchTerm}
          mobileEvidenceOpen={mobileEvidenceOpen}
          setMobileEvidenceOpen={setMobileEvidenceOpen}
          auditMode={auditMode}
        />
      ) : null}
    </QueryState>
  )
}

function IgrHistoryExperience({
  rawData,
  selectedTransactionId,
  setSelectedTransactionId,
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
  deferredSearchTerm,
  mobileEvidenceOpen,
  setMobileEvidenceOpen,
  auditMode
}) {
  const viewModel = buildIgrHistoryViewModel(rawData)
  const searchValue = deferredSearchTerm.trim().toLowerCase()
  const filteredYearGroups = buildFilteredYearGroups(
    viewModel.yearGroups,
    selectedYear,
    selectedType,
    selectedOwner,
    searchValue
  )
  const filteredTransactions = filteredYearGroups.flatMap((group) => group.transactions)
  const timelineTransactions = sortTransactions(filteredTransactions, 'earliest')
  const forensicsTransactions = sortTransactions(filteredTransactions, selectedSort)
  const selectedTransaction =
    forensicsTransactions.find((transaction) => transaction.id === selectedTransactionId) ??
    forensicsTransactions[0] ??
    null
  const hasActiveFilters =
    selectedYear !== 'all' ||
    selectedType !== 'all' ||
    selectedOwner !== 'all' ||
    selectedSort !== 'latest' ||
    searchTerm.trim().length > 0
  const workflowRoute =
    viewModel.technical.workflowRunId && viewModel.technical.workflowRunId !== 'Unavailable'
      ? `/app/workflows/${viewModel.technical.workflowRunId}`
      : null

  useEffect(() => {
    if (!forensicsTransactions.length) {
      if (selectedTransactionId !== null) {
        setSelectedTransactionId(null)
      }
      return
    }

    if (!forensicsTransactions.some((transaction) => transaction.id === selectedTransactionId)) {
      setSelectedTransactionId(forensicsTransactions[0].id)
    }
  }, [forensicsTransactions, selectedTransactionId, setSelectedTransactionId])

  function handleSelectTransaction(transaction) {
    setSelectedTransactionId(transaction.id)
    setMobileEvidenceOpen(true)
  }

  function clearFilters() {
    setSelectedYear('all')
    setSelectedType('all')
    setSelectedOwner('all')
    setSelectedSort('latest')
    setSearchTerm('')
  }

  return (
    <>
      <div className="space-y-6">
        <PropertyIdentityHero
          hero={viewModel.hero}
          technical={viewModel.technical}
          matchConfidence={viewModel.matchConfidence}
          workflowRoute={workflowRoute}
          onExportJson={() => downloadJsonFile(`igr-contract-${viewModel.contract?.workflowId ?? rawData.id ?? 'record'}.json`, viewModel.contract)}
        />

        <CoverageNotice sourceIssues={viewModel.sourceIssues} hasSampleOnlyYears={viewModel.hasSampleOnlyYears} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="space-y-6">
            <OwnershipTimeline
              transactions={timelineTransactions}
              selectedTransactionId={selectedTransaction?.id ?? null}
              onSelectTransaction={handleSelectTransaction}
              yearGroups={filteredYearGroups}
            />
          </div>

          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <div className="hidden xl:block">
              <TransactionDrawer transaction={selectedTransaction} technical={viewModel.technical} />
            </div>
            <MatchConfidencePanel matchConfidence={viewModel.matchConfidence} />
          </div>
        </div>

        <TransactionForensicsTable
          transactions={forensicsTransactions}
          yearGroups={filteredYearGroups}
          selectedTransactionId={selectedTransaction?.id ?? null}
          onSelectTransaction={handleSelectTransaction}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          selectedOwner={selectedOwner}
          setSelectedOwner={setSelectedOwner}
          selectedSort={selectedSort}
          setSelectedSort={setSelectedSort}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          typeOptions={viewModel.typeOptions}
          yearOptions={viewModel.yearOptions}
          ownerOptions={viewModel.ownerOptions}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <LocationResolutionTrail locationVerification={viewModel.locationVerification} />
          <LegalInsightPanel insights={viewModel.legalInsights} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <PropertyStory story={viewModel.propertyStory} />

          <Card className="border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,244,246,0.92))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow">Source Authenticity</p>
                <h2 className="mt-2 font-document text-[2rem] font-semibold leading-none text-primary">Verified source-run context</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
                  This IGR screen is rendered directly from the source-run record, its normalized canonical data, and the workflow-linked metadata packet.
                </p>
              </div>
              <div className="rounded-2xl bg-primary-fixed/70 p-3 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.1rem] border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Route semantics</p>
                <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                  The route parameter is named <span className="font-semibold text-primary">propertyId</span>, but this page intentionally renders a <span className="font-semibold text-primary">SourceRun</span> detail packet from <span className="font-semibold text-primary">/api/v1/source-runs/{'{id}'}/</span>.
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-outline-variant/15 bg-surface-container-low px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">Normalization strategy</p>
                <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                  Alternate backend fields like <span className="font-semibold text-primary">PropertyDescription</span>, <span className="font-semibold text-primary">property_description</span>, <span className="font-semibold text-primary">description</span>, <span className="font-semibold text-primary">PurchaserName</span>, and <span className="font-semibold text-primary">RDate</span> are normalized safely before rendering.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <LegalInterpreterSection terms={viewModel.legalTerms} />
        <SourceRunMetadataPanel technical={viewModel.technical} auditMode={auditMode} />
        {auditMode ? (
          <>
            <JsonExplorer tabs={viewModel.rawExplorerTabs} />
            <AuditModePanel
              title="IGR Audit Appendix"
              description="Raw IGR source-run payloads and explorer tabs stay hidden unless audit mode is enabled."
              payloads={[
                { label: 'IGR Contract View Model', payload: viewModel.contract ?? null },
                { label: 'Raw IGR Payload', payload: rawData ?? null }
              ]}
            />
          </>
        ) : null}
      </div>

      {mobileEvidenceOpen && selectedTransaction ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(3,22,50,0.34)] px-3 pb-3 backdrop-blur-sm xl:hidden">
          <div className="max-h-[88vh] w-full overflow-auto rounded-[1.8rem] border border-outline-variant/20 bg-surface-container-lowest shadow-[0_30px_80px_rgba(3,22,50,0.2)]">
            <TransactionDrawer
              transaction={selectedTransaction}
              technical={viewModel.technical}
              onClose={() => setMobileEvidenceOpen(false)}
              mobile
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
