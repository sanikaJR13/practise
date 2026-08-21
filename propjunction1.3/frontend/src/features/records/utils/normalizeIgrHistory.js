import { toIGRSearchReport } from '@/contracts'

function toArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return null
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function compactText(value) {
  if (value === undefined || value === null) {
    return ''
  }

  return String(value).replace(/\s+/g, ' ').trim()
}

function toTitleCase(value) {
  return compactText(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function parseDate(value) {
  if (!value && value !== 0) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateLabel(value, fallbackYear = null) {
  const parsed = parseDate(value)
  if (parsed) {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(parsed)
  }

  if (fallbackYear) {
    return String(fallbackYear)
  }

  return 'Date unavailable'
}

function formatDateTimeLabel(value) {
  const parsed = parseDate(value)
  if (!parsed) {
    return 'Timestamp unavailable'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed)
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value)
}

function parseNumberish(value) {
  const text = compactText(value)
  if (!text) {
    return null
  }

  const normalized = text.replace(/[,\s]/g, '')
  const numeric = Number.parseFloat(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function formatConsideration(value) {
  const text = compactText(value)
  if (!text) {
    return 'Not stated'
  }

  if (/^(nil|gift|na|n\/a)$/i.test(text)) {
    return toTitleCase(text)
  }

  if (/^rs\.?/i.test(text) || /inr/i.test(text) || (/[a-z]/i.test(text) && !/^\d/.test(text))) {
    return text
  }

  const numeric = parseNumberish(text)
  if (numeric !== null) {
    return `Rs ${formatNumber(numeric)}`
  }

  return text
}

function formatArea(value) {
  const text = compactText(value)
  return text || 'Area not stated'
}

function normalizeTransactionType(value) {
  const text = compactText(value).toLowerCase()
  if (!text) {
    return 'Registry Entry'
  }

  if (text.includes('sale')) {
    return 'Sale Deed'
  }

  if (text.includes('gift')) {
    return 'Gift Deed'
  }

  if (text.includes('release')) {
    return 'Release Deed'
  }

  if (text.includes('mortgage')) {
    return 'Mortgage'
  }

  if (text.includes('encumbrance')) {
    return 'Encumbrance'
  }

  if (text.includes('conveyance')) {
    return 'Conveyance'
  }

  if (text.includes('partition')) {
    return 'Partition'
  }

  return toTitleCase(value)
}

function normalizePartyName(value, fallback) {
  const text = compactText(value).replace(/^\{+|\}+$/g, '')
  return text || fallback
}

function normalizePersonKey(value) {
  return normalizePartyName(value, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function parseLocationLabel(value) {
  const parts = compactText(value)
    .split(/[\/,]/)
    .map((part) => part.trim())
    .filter(Boolean)

  return {
    district: parts[0] ?? '',
    taluka: parts[1] ?? '',
    village: parts[2] ?? ''
  }
}

function getSourceStatusTone(status) {
  if (status === 'failed') {
    return 'warning'
  }

  if (status === 'partial' || status === 'captcha_pending' || status === 'running') {
    return 'info'
  }

  return 'success'
}

function getYearStatusNote(yearGroup) {
  if (yearGroup.errorMessage) {
    return yearGroup.errorMessage
  }

  if (yearGroup.status === 'failed') {
    return 'This registry year did not complete successfully.'
  }

  if (yearGroup.status === 'empty' || yearGroup.transactionCount === 0) {
    return 'No registry transactions were surfaced for this year.'
  }

  if (yearGroup.sampleOnly) {
    return 'Showing sampled transactions because full raw rows were not returned in this payload.'
  }

  return 'Source-backed registry transactions available for review.'
}

function getTransactionArrayFromPayload(payload) {
  if (!payload) {
    return []
  }

  const transactions = toArray(payload.transactions)
  if (transactions.length > 0) {
    return transactions
  }

  return toArray(payload.sample_transactions)
}

function buildReferenceKey(surveyNumber, hissaNumber) {
  if (!surveyNumber) {
    return ''
  }

  return `${compactText(surveyNumber).toLowerCase()}::${compactText(hissaNumber).toLowerCase()}`
}

function parseSurveyReference(...sources) {
  const combined = sources.map((source) => compactText(source)).filter(Boolean).join(' | ')
  if (!combined) {
    return {
      surveyNumber: '',
      hissaNumber: '',
      label: 'Reference unavailable',
      key: ''
    }
  }

  const labelledSurvey =
    combined.match(/(?:survey|gat)\s*(?:no\.?|number)?\s*[:#-]?\s*([a-z0-9/-]+)/i) ||
    combined.match(/property\s*(?:no\.?|number)?\s*[:#-]?\s*([a-z0-9/-]+)/i)
  const embeddedSurvey = combined.match(/\b([0-9]{1,5}[a-z]?(?:\/[0-9a-z-]+)+)\b/i)
  const labelledHissa = combined.match(/hissa\s*(?:no\.?|number)?\s*[:#-]?\s*([a-z0-9/-]+)/i)

  let surveyNumber = compactText(labelledSurvey?.[1] ?? embeddedSurvey?.[1])
  let hissaNumber = compactText(labelledHissa?.[1])

  if (surveyNumber && !hissaNumber && surveyNumber.includes('/')) {
    const [surveyBase, ...rest] = surveyNumber.split('/')
    surveyNumber = compactText(surveyBase)
    hissaNumber = compactText(rest.join('/'))
  }

  const label = surveyNumber
    ? [surveyNumber, hissaNumber ? `Hissa ${hissaNumber}` : null].filter(Boolean).join(' / ')
    : 'Reference unavailable'

  return {
    surveyNumber,
    hissaNumber,
    label,
    key: buildReferenceKey(surveyNumber, hissaNumber)
  }
}

function getOwnerHistoryFromCanonical(canonicalData, transactions) {
  const canonicalHistory = toArray(canonicalData?.ownership_history)
  if (canonicalHistory.length > 0) {
    return canonicalHistory
  }

  return transactions.map((transaction, index) => ({
    id: `ownership-${index + 1}`,
    person: transaction?.buyer ?? 'Buyer not surfaced',
    from_party: transaction?.seller ?? 'Seller not surfaced',
    to_party: transaction?.buyer ?? 'Buyer not surfaced',
    date: transaction?.rawDate ?? 'Unavailable',
    year: transaction?.year ?? 'Unknown',
    type: transaction?.type ?? 'Registry Entry',
    consideration: transaction?.considerationLabel ?? 'Not stated',
    area: transaction?.areaLabel ?? 'Area not stated'
  }))
}

function deriveYearGroups(source) {
  const workflowPayload =
    source?.result_json?.sources?.igr ??
    source?.resultJson?.sources?.igr ??
    source?.sources?.igr ??
    null

  if (workflowPayload?.years) {
    return workflowPayload.years.map((yearEntry, index) => {
      const yearPayload = yearEntry.result ?? {}
      const transactions = getTransactionArrayFromPayload(yearPayload).map((transaction, transactionIndex) =>
        normalizeTransaction(transaction, {
          index: transactionIndex,
          sourceYear: firstDefined(yearEntry.year, yearPayload.year),
          workflowStatus: firstDefined(yearEntry.status, yearPayload.status, workflowPayload.status),
          workflowStep: firstDefined(yearPayload.workflow_step, source.currentStepLabel, source.stepLabel),
          runId: firstDefined(yearPayload.run_id, yearEntry.run_id, source.id),
          selectedLabels: yearPayload.selected_labels ?? {}
        })
      )

      return {
        id: `year-${firstDefined(yearEntry.year, index)}`,
        year: firstDefined(yearEntry.year, yearPayload.year, 'Unknown'),
        status: firstDefined(yearEntry.status, yearPayload.status, workflowPayload.status, 'available'),
        workflowStep: firstDefined(yearPayload.workflow_step, source.currentStepLabel, source.stepLabel, 'Pending'),
        runId: firstDefined(yearPayload.run_id, yearEntry.run_id, source.id),
        selectedLabels: yearPayload.selected_labels ?? {},
        transactionCount: firstDefined(yearPayload.transaction_count, transactions.length, 0),
        transactions,
        sampleOnly: toArray(yearPayload.sample_transactions).length > 0 && toArray(yearPayload.transactions).length === 0,
        errorMessage: yearEntry.error_message ?? '',
        locationLabel: source.locationLabel || ''
      }
    })
  }

  if (source?.entries) {
    const grouped = new Map()

    source.entries.forEach((entry, index) => {
      const normalized = normalizeTransaction(entry, {
        index,
        sourceYear: firstDefined(entry.year, index),
        workflowStatus: firstDefined(entry.status, source.status, 'available'),
        workflowStep: 'Mock history entry',
        runId: source.id,
        selectedLabels: {}
      })

      if (!grouped.has(normalized.year)) {
        grouped.set(normalized.year, [])
      }

      grouped.get(normalized.year).push(normalized)
    })

    return Array.from(grouped.entries()).map(([year, transactions]) => ({
      id: `year-${year}`,
      year,
      status: 'completed',
      workflowStep: 'Mock history entry',
      runId: source.id,
      selectedLabels: {},
      transactionCount: transactions.length,
      transactions,
      sampleOnly: false,
      errorMessage: '',
      locationLabel: ''
    }))
  }

  const canonicalData =
    source?.canonicalData ??
    source?.canonical_data ??
    source?.metadata?.canonical_data ??
    source?.metadata?.canonicalData ??
    null
  const resultPayload = source?.resultPayload ?? source?.result ?? source?.metadata?.result ?? {}
  const rawTransactions =
    toArray(canonicalData?.all_transactions).length > 0
      ? toArray(canonicalData.all_transactions)
      : toArray(canonicalData?.transactions).length > 0
        ? toArray(canonicalData.transactions)
        : getTransactionArrayFromPayload(resultPayload)

  const normalizedTransactions = rawTransactions.map((transaction, index) =>
    normalizeTransaction(transaction, {
      index,
      sourceYear: firstDefined(source.year, source.source_year, resultPayload.year),
      workflowStatus: firstDefined(source.status, resultPayload.status, source.rawStatus, 'available'),
      workflowStep: firstDefined(source.stepLabel, source.workflow_step, resultPayload.workflow_step, 'Pending'),
      runId: firstDefined(source.runDirectory, source.run_dir, source.run_id, resultPayload.run_id, source.id),
      selectedLabels: resultPayload.selected_labels ?? canonicalData?.selected_labels ?? {}
    })
  )

  return [
    {
      id: `year-${firstDefined(source.year, resultPayload.year, source.id)}`,
      year: firstDefined(source.year, resultPayload.year, 'Unknown'),
      status: firstDefined(source.status, resultPayload.status, source.rawStatus, 'available'),
      workflowStep: firstDefined(source.stepLabel, source.workflow_step, resultPayload.workflow_step, 'Pending'),
      runId: firstDefined(source.runDirectory, source.run_dir, source.run_id, resultPayload.run_id, source.id),
      selectedLabels: resultPayload.selected_labels ?? canonicalData?.selected_labels ?? {},
      transactionCount: firstDefined(resultPayload.transaction_count, canonicalData?.transaction_count, normalizedTransactions.length, 0),
      transactions: normalizedTransactions,
      sampleOnly: toArray(resultPayload.sample_transactions).length > 0 && toArray(resultPayload.transactions).length === 0,
      errorMessage: firstDefined(source.errorMessage, source.error_message, resultPayload.error?.message, ''),
      locationLabel: source.locationLabel || ''
    }
  ]
}

export function normalizeTransaction(transaction, context = {}) {
  const sourceTransaction = asRecord(transaction)
  const parties = compactText(firstDefined(sourceTransaction.parties, sourceTransaction.partiesLabel))
  const [partySeller = '', partyBuyer = ''] = parties.split('->').map((part) => compactText(part))
  const seller = normalizePartyName(
    firstDefined(
      sourceTransaction.from_party,
      sourceTransaction.fromParty,
      sourceTransaction.seller,
      sourceTransaction.SellerName,
      partySeller
    ),
    'Seller not surfaced'
  )
  const buyer = normalizePartyName(
    firstDefined(
      sourceTransaction.to_party,
      sourceTransaction.toParty,
      sourceTransaction.buyer,
      sourceTransaction.PurchaserName,
      sourceTransaction.purchaser_name,
      partyBuyer
    ),
    'Buyer not surfaced'
  )
  const rawDate = firstDefined(
    sourceTransaction.date,
    sourceTransaction.RDate,
    sourceTransaction.registry_date,
    sourceTransaction.document_date,
    ''
  )
  const inferredYear =
    firstDefined(
      parseDate(rawDate)?.getFullYear(),
      sourceTransaction.year,
      sourceTransaction.registryYear,
      context.sourceYear,
      null
    ) ?? 'Unknown'
  const type = normalizeTransactionType(
    firstDefined(
      sourceTransaction.type,
      sourceTransaction.document_type,
      sourceTransaction.doc_type,
      sourceTransaction.transaction_type,
      sourceTransaction.DName
    )
  )
  const propertyDescription = compactText(
    firstDefined(
      sourceTransaction.PropertyDescription,
      sourceTransaction.property_description,
      sourceTransaction.description,
      sourceTransaction.propertyDescription,
      sourceTransaction.details
    )
  )
  const surveyReference = parseSurveyReference(
    propertyDescription,
    sourceTransaction.survey_number_text,
    sourceTransaction.survey_number,
    sourceTransaction.property_number
  )
  const considerationValue = parseNumberish(firstDefined(sourceTransaction.consideration, sourceTransaction.consideration_amount))
  const areaLabel = formatArea(sourceTransaction.area)
  const fallbackSortTime = Number.isFinite(Number(inferredYear)) ? new Date(`${inferredYear}-01-01`).getTime() : 0

  return {
    id:
      firstDefined(sourceTransaction.id, sourceTransaction.run_id) ??
      `txn-${context.sourceYear ?? 'na'}-${context.index ?? 0}-${type.toLowerCase().replace(/\s+/g, '-')}`,
    sequenceNumber: Number(context.index ?? 0) + 1,
    year: inferredYear,
    rawDate: compactText(rawDate) || 'Unavailable',
    dateLabel: formatDateLabel(rawDate, inferredYear),
    sortTime: parseDate(rawDate)?.getTime() ?? fallbackSortTime,
    type,
    seller,
    buyer,
    considerationValue,
    considerationLabel: formatConsideration(firstDefined(sourceTransaction.consideration, sourceTransaction.consideration_amount)),
    considerationMissing: !compactText(firstDefined(sourceTransaction.consideration, sourceTransaction.consideration_amount)),
    areaLabel,
    areaMissing: areaLabel === 'Area not stated',
    propertyDescription: propertyDescription || 'Property description not surfaced in this registry row.',
    surveyNumber: surveyReference.surveyNumber,
    hissaNumber: surveyReference.hissaNumber,
    surveyReferenceLabel: surveyReference.label,
    surveyReferenceKey: surveyReference.key,
    workflowStatus: context.workflowStatus ?? 'available',
    workflowStep: context.workflowStep ?? 'Available',
    runId: context.runId ?? '',
    selectedLabels: context.selectedLabels ?? {},
    sourceYear: context.sourceYear ?? inferredYear,
    ocrConfidence: firstDefined(sourceTransaction.ocr_confidence, sourceTransaction.ocrConfidence, null),
    raw: sourceTransaction
  }
}

function sortTransactionsAscending(transactions) {
  return toArray(transactions).sort((left, right) => (left?.sortTime ?? 0) - (right?.sortTime ?? 0))
}

function sortTransactionsDescending(transactions) {
  return toArray(transactions).sort((left, right) => (right?.sortTime ?? 0) - (left?.sortTime ?? 0))
}

function buildQueryReference(source, transactions) {
  const canonicalData =
    source?.canonicalData ??
    source?.canonical_data ??
    source?.metadata?.canonical_data ??
    source?.metadata?.canonicalData ??
    null
  const resultPayload = source?.resultPayload ?? source?.result ?? source?.metadata?.result ?? {}
  const latestDescription = transactions[0]?.propertyDescription ?? ''
  const parsed = parseSurveyReference(
    canonicalData?.survey_number_text,
    canonicalData?.property_number,
    resultPayload?.survey_number_text,
    source?.queryParams?.property_number,
    source?.inputPayload?.property_number,
    latestDescription
  )

  const propertyNumber =
    firstDefined(
      canonicalData?.property_number,
      source?.queryParams?.property_number,
      source?.inputPayload?.property_number,
      parsed.label !== 'Reference unavailable' ? parsed.label : null
    ) ?? 'Unavailable'

  return {
    surveyNumber: parsed.surveyNumber,
    hissaNumber: parsed.hissaNumber,
    propertyNumber,
    displayLabel: parsed.label,
    key: parsed.key
  }
}

function scoreTransactionMatch(transaction, queryReference) {
  const matchedKeywords = []
  const description = compactText(transaction.propertyDescription).toLowerCase()
  const queryProperty = compactText(queryReference.propertyNumber).toLowerCase()

  if (queryReference.surveyNumber && transaction.surveyNumber) {
    if (normalizePersonKey(transaction.surveyNumber) === normalizePersonKey(queryReference.surveyNumber)) {
      matchedKeywords.push(`Survey ${queryReference.surveyNumber}`)
      if (queryReference.hissaNumber) {
        if (!transaction.hissaNumber) {
          return {
            status: 'partial',
            score: 78,
            matchedKeywords,
            explanation: 'Survey number matches, but the registry row does not surface a hissa reference.'
          }
        }

        if (normalizePersonKey(transaction.hissaNumber) === normalizePersonKey(queryReference.hissaNumber)) {
          matchedKeywords.push(`Hissa ${queryReference.hissaNumber}`)
          return {
            status: 'exact',
            score: 100,
            matchedKeywords,
            explanation: 'Survey and hissa references align directly with the queried property.'
          }
        }

        return {
          status: 'ambiguous',
          score: 54,
          matchedKeywords,
          explanation: 'Survey number matches, but the hissa reference diverges from the queried property.'
        }
      }

      return {
        status: 'exact',
        score: 94,
        matchedKeywords,
        explanation: 'The registry row carries the same survey reference as the queried property.'
      }
    }

    if (queryProperty && description.includes(queryProperty)) {
      matchedKeywords.push(queryReference.propertyNumber)
      return {
        status: 'partial',
        score: 66,
        matchedKeywords,
        explanation: 'Description keywords overlap, but the parsed survey reference does not match exactly.'
      }
    }

    return {
      status: 'unmatched',
      score: 14,
      matchedKeywords,
      explanation: 'The parsed survey reference differs from the queried property.'
    }
  }

  if (queryProperty && description.includes(queryProperty.toLowerCase())) {
    matchedKeywords.push(queryReference.propertyNumber)
    return {
      status: 'ambiguous',
      score: 52,
      matchedKeywords,
      explanation: 'The description contains the queried property number, but no parsed survey reference was surfaced.'
    }
  }

  if (queryReference.surveyNumber && description.includes(queryReference.surveyNumber.toLowerCase())) {
    matchedKeywords.push(`Survey ${queryReference.surveyNumber}`)
    return {
      status: 'partial',
      score: 64,
      matchedKeywords,
      explanation: 'The description mentions the queried survey number even though the structured survey field is absent.'
    }
  }

  return {
    status: 'ambiguous',
    score: queryReference.surveyNumber || queryProperty ? 32 : 48,
    matchedKeywords,
    explanation:
      queryReference.surveyNumber || queryProperty
        ? 'The row does not expose enough survey linkage to confirm a precise match.'
        : 'The source payload does not expose a strong property reference to score against.'
  }
}

function applyTransactionIntelligence(transactions, queryReference) {
  const chronological = sortTransactionsAscending(transactions)
  const byId = new Map()

  chronological.forEach((transaction, index) => {
    const previousTransaction = index > 0 ? chronological[index - 1] : null
    const match = scoreTransactionMatch(transaction, queryReference)
    const previousBuyerKey = normalizePersonKey(previousTransaction?.buyer)
    const currentSellerKey = normalizePersonKey(transaction.seller)
    const sameParticipant = normalizePersonKey(transaction.seller) && normalizePersonKey(transaction.seller) === normalizePersonKey(transaction.buyer)

    const continuityStatus = !previousTransaction
      ? 'origin'
      : previousBuyerKey && currentSellerKey && previousBuyerKey === currentSellerKey
        ? 'continuous'
        : 'review'

    const suspiciousReasons = []

    if (transaction.considerationMissing) {
      suspiciousReasons.push('Consideration amount is missing or not stated.')
    }

    if (transaction.areaMissing) {
      suspiciousReasons.push('Area involved is not surfaced in this registry row.')
    }

    if (continuityStatus === 'review') {
      suspiciousReasons.push('Visible seller-to-buyer continuity is not direct between adjacent registry rows.')
    }

    if (match.status === 'ambiguous') {
      suspiciousReasons.push('Property reference is partially surfaced and should be cross-checked.')
    }

    if (match.status === 'unmatched') {
      suspiciousReasons.push('Survey linkage appears mismatched against the queried property.')
    }

    if (sameParticipant && transaction.seller !== 'Seller not surfaced') {
      suspiciousReasons.push('The same party appears on both sides of the registry event.')
    }

    const legalLinkageStatus =
      match.status === 'exact'
        ? continuityStatus === 'review'
          ? 'Property-linked, continuity review advised'
          : 'Property-linked'
        : match.status === 'partial'
          ? 'Partial survey linkage'
          : match.status === 'ambiguous'
            ? 'Ambiguous property linkage'
            : 'Survey mismatch'

    const suspiciousLevel =
      suspiciousReasons.length >= 3 || match.status === 'unmatched'
        ? 'high'
        : suspiciousReasons.length > 0
          ? 'medium'
          : 'low'

    const enriched = {
      ...transaction,
      sequenceNumber: index + 1,
      previousBuyer: previousTransaction?.buyer ?? null,
      continuityStatus,
      matchStatus: match.status,
      matchScore: match.score,
      matchExplanation: match.explanation,
      matchedKeywords: match.matchedKeywords,
      suspiciousReasons,
      suspiciousCount: suspiciousReasons.length,
      suspiciousLevel,
      legalLinkageStatus
    }

    byId.set(enriched.id, enriched)
  })

  return transactions.map((transaction) => byId.get(transaction.id) ?? transaction)
}

function buildYearGroupsWithIntelligence(yearGroups, enrichedTransactions) {
  const byId = new Map(enrichedTransactions.map((transaction) => [transaction.id, transaction]))

  return yearGroups.map((group) => {
    const transactions = group.transactions.map((transaction) => byId.get(transaction.id) ?? transaction)
    return {
      ...group,
      note: getYearStatusNote(group),
      suspiciousCount: transactions.filter((transaction) => transaction.suspiciousCount > 0).length,
      matchStatuses: transactions.reduce((accumulator, transaction) => {
        accumulator[transaction.matchStatus] = (accumulator[transaction.matchStatus] ?? 0) + 1
        return accumulator
      }, {}),
      transactions
    }
  })
}

function buildYearScope(transactions, yearGroups) {
  const yearValues = transactions.map((transaction) => Number(transaction.year)).filter(Number.isFinite)
  if (yearValues.length === 0) {
    const groupYears = yearGroups.map((group) => Number(group.year)).filter(Number.isFinite)
    if (groupYears.length === 0) {
      return 'Scope unavailable'
    }

    const minYear = Math.min(...groupYears)
    const maxYear = Math.max(...groupYears)
    return minYear === maxYear ? `${minYear}` : `${minYear} - ${maxYear}`
  }

  const minYear = Math.min(...yearValues)
  const maxYear = Math.max(...yearValues)
  return minYear === maxYear ? `${minYear}` : `${minYear} - ${maxYear}`
}

function buildPropertyIdentity(source, transactions, yearGroups, queryReference) {
  const canonicalData =
    source?.canonicalData ??
    source?.canonical_data ??
    source?.metadata?.canonical_data ??
    source?.metadata?.canonicalData ??
    null
  const resultPayload = source?.resultPayload ?? source?.result ?? source?.metadata?.result ?? {}
  const latestTransaction = sortTransactionsDescending(transactions)[0] ?? null
  const latestBuyer = latestTransaction?.buyer
  const locationBits = parseLocationLabel(source?.locationLabel)
  const selectedLabels = resultPayload?.selected_labels ?? canonicalData?.selected_labels ?? {}

  return {
    surveyNumber: queryReference.surveyNumber || 'Unavailable',
    hissaNumber: queryReference.hissaNumber || 'Not surfaced',
    propertyNumber: queryReference.propertyNumber || 'Unavailable',
    village:
      firstDefined(
        selectedLabels.village,
        source?.mapping?.village?.label,
        locationBits.village,
        source?.queryParams?.village
      ) ?? 'Village unavailable',
    taluka:
      firstDefined(
        selectedLabels.taluka,
        source?.mapping?.taluka?.label,
        locationBits.taluka,
        source?.queryParams?.taluka
      ) ?? 'Taluka unavailable',
    district:
      firstDefined(
        selectedLabels.district,
        source?.mapping?.district?.label,
        locationBits.district,
        source?.queryParams?.district
      ) ?? 'District unavailable',
    currentOwner:
      firstDefined(
        canonicalData?.current_owner,
        latestBuyer && latestBuyer !== 'Buyer not surfaced' ? latestBuyer : null
      ) ?? 'Owner not surfaced',
    transactionCount:
      firstDefined(
        canonicalData?.transaction_count,
        resultPayload?.transaction_count,
        source?.summary?.totalRecords,
        transactions.length
      ) ?? 0,
    workflowStatus: firstDefined(source?.status, resultPayload?.status, 'available'),
    workflowStatusTone: getSourceStatusTone(firstDefined(source?.status, resultPayload?.status, 'available')),
    latestTransactionType: latestTransaction?.type ?? 'Not surfaced',
    lastTransactionDate: latestTransaction?.dateLabel ?? 'Date unavailable',
    currentArea: latestTransaction?.areaLabel ?? 'Area not stated',
    yearScope: buildYearScope(transactions, yearGroups)
  }
}

function buildMatchConfidence(transactions, queryReference, yearGroups) {
  const weights = { exact: 100, partial: 72, ambiguous: 42, unmatched: 12 }
  const counts = { exact: 0, partial: 0, ambiguous: 0, unmatched: 0 }
  const matchedKeywords = new Set()

  transactions.forEach((transaction) => {
    counts[transaction.matchStatus] = (counts[transaction.matchStatus] ?? 0) + 1
    transaction.matchedKeywords.forEach((keyword) => matchedKeywords.add(keyword))
  })

  const transactionScore =
    transactions.length > 0
      ? Math.round(
          transactions.reduce((total, transaction) => total + (weights[transaction.matchStatus] ?? 40), 0) /
            transactions.length
        )
      : 0
  const failedOrEmptyYears = yearGroups.filter((group) => group.status === 'failed' || group.transactionCount === 0).length
  const overallScore = Math.max(0, Math.min(100, transactionScore - failedOrEmptyYears * 4))

  let label = 'Weak linkage'
  if (overallScore >= 85) {
    label = 'High confidence'
  } else if (overallScore >= 65) {
    label = 'Moderate confidence'
  } else if (overallScore >= 45) {
    label = 'Needs review'
  }

  const summary =
    counts.exact > 0
      ? `${counts.exact} registry row(s) carry exact survey linkage to the queried property.`
      : counts.partial > 0
        ? `Property linkage is supported primarily by partial survey overlap and description keywords.`
        : counts.ambiguous > 0
          ? 'Available rows are usable, but survey linkage remains ambiguous.'
          : 'No surfaced row strongly confirms the queried property reference.'

  return {
    overallScore,
    label,
    summary,
    exactCount: counts.exact,
    partialCount: counts.partial,
    ambiguousCount: counts.ambiguous,
    unmatchedCount: counts.unmatched,
    matchedKeywords: Array.from(matchedKeywords),
    queryReference,
    rows: transactions.map((transaction) => ({
      id: transaction.id,
      label: `${transaction.dateLabel} / ${transaction.type}`,
      status: transaction.matchStatus,
      score: transaction.matchScore,
      surveyReference: transaction.surveyReferenceLabel,
      explanation: transaction.matchExplanation
    }))
  }
}

function buildLocationVerification(source, identity) {
  const mapping = source?.mapping ?? {}
  const selectedLabels = source?.resultPayload?.selected_labels ?? source?.canonicalData?.selected_labels ?? {}
  const queryParams = source?.queryParams ?? {}

  const steps = ['district', 'taluka', 'village'].map((level) => {
    const readableLabel = firstDefined(mapping[level]?.label, selectedLabels[level], identity[level]) ?? 'Unavailable'
    const sourceValue = firstDefined(mapping[level]?.value, queryParams[level], '') ?? ''
    const responseLabel = firstDefined(selectedLabels[level], mapping[level]?.label, readableLabel) ?? 'Unavailable'

    return {
      id: level,
      label: toTitleCase(level),
      readableLabel,
      sourceValue: compactText(sourceValue) || 'Not surfaced',
      responseLabel,
      verified: Boolean(readableLabel && readableLabel !== 'Unavailable' && sourceValue && sourceValue !== 'Not surfaced')
    }
  })

  return {
    steps,
    summary: 'The registry query is routed through saved mapping labels and source-specific values so users can see how the location was resolved internally.'
  }
}

function buildOwnerOptions(transactions) {
  const owners = new Set()

  transactions.forEach((transaction) => {
    if (transaction.seller !== 'Seller not surfaced') {
      owners.add(transaction.seller)
    }
    if (transaction.buyer !== 'Buyer not surfaced') {
      owners.add(transaction.buyer)
    }
  })

  return Array.from(owners).sort()
}

function buildPropertyStory(transactions, identity, yearGroups) {
  if (transactions.length === 0) {
    if (yearGroups.length > 0) {
      return 'The searched registry years are available for review, but no transaction chronology could be assembled from the surfaced payload. Users should inspect year-level statuses, technical metadata, and raw source values before drawing ownership conclusions.'
    }

    return 'No registry history was available in this payload. The page still preserves technical and raw data context for audit review.'
  }

  const sentences = sortTransactionsAscending(transactions)
    .slice(0, 6)
    .map((transaction) => {
      const when = transaction.dateLabel !== 'Date unavailable' ? transaction.dateLabel : String(transaction.year)
      const seller =
        transaction.seller !== 'Seller not surfaced' ? transaction.seller : 'a prior recorded holder'
      const buyer = transaction.buyer !== 'Buyer not surfaced' ? transaction.buyer : 'a subsequent recorded holder'
      const matchNote =
        transaction.matchStatus === 'exact'
          ? ' Survey linkage is exact.'
          : transaction.matchStatus === 'partial'
            ? ' Survey linkage is partial.'
            : transaction.matchStatus === 'ambiguous'
              ? ' Survey linkage remains ambiguous.'
              : ' Survey linkage appears mismatched.'

      return `${when}: ${seller} appears linked to a ${transaction.type.toLowerCase()} in favor of ${buyer}.${matchNote}`
    })

  return `Available registry evidence for Survey ${identity.surveyNumber} suggests the following registry event sequence. ${sentences.join(' ')}`
}

function buildLegalInsights(transactions, yearGroups) {
  const insights = []
  const chronological = sortTransactionsAscending(transactions)
  const missingConsideration = transactions.filter((transaction) => transaction.considerationMissing)
  const ambiguousOrUnmatched = transactions.filter(
    (transaction) => transaction.matchStatus === 'ambiguous' || transaction.matchStatus === 'unmatched'
  )
  const failedYears = yearGroups.filter((group) => group.status === 'failed')
  const emptyYears = yearGroups.filter((group) => group.transactionCount === 0 && group.status !== 'failed')
  const fragmentedAreas = Array.from(new Set(transactions.map((transaction) => transaction.areaLabel).filter((value) => value !== 'Area not stated')))
  const recurringOwners = new Map()

  transactions.forEach((transaction) => {
    ;[transaction.seller, transaction.buyer].forEach((party) => {
      if (!party || party.includes('not surfaced')) {
        return
      }

      recurringOwners.set(party, (recurringOwners.get(party) ?? 0) + 1)
    })
  })

  const repeatedParty = Array.from(recurringOwners.entries()).find(([, count]) => count >= 3)

  const rapidChanges = []
  chronological.forEach((transaction, index) => {
    const previousTransaction = index > 0 ? chronological[index - 1] : null
    if (!previousTransaction) {
      return
    }

    const currentYear = Number(transaction.year)
    const previousYear = Number(previousTransaction.year)
    if (Number.isFinite(currentYear) && Number.isFinite(previousYear) && currentYear - previousYear <= 2) {
      rapidChanges.push(`${previousTransaction.year} -> ${transaction.year}`)
    }
  })

  if (rapidChanges.length > 0) {
    insights.push({
      id: 'insight-rapid',
      severity: 'high',
      title: 'Ownership changed quickly across visible registry years',
      impact: 'Rapid transfer sequences can require closer document-chain verification.',
      explanation: `${rapidChanges.length} adjacent transfer gap(s) occurred within two years or less in the surfaced chronology.`,
      references: rapidChanges
    })
  }

  if (transactions.length >= 5) {
    insights.push({
      id: 'insight-volume',
      severity: 'medium',
      title: 'Unusually high visible transaction volume',
      impact: 'A busy registry history increases the amount of evidence that should be reconciled.',
      explanation: `${transactions.length} surfaced registry rows were linked to this query across the available years.`,
      references: [buildYearScope(transactions, yearGroups)]
    })
  }

  if (missingConsideration.length > 0) {
    insights.push({
      id: 'insight-consideration',
      severity: 'medium',
      title: 'Consideration is missing in some surfaced registry rows',
      impact: 'Missing consideration limits financial interpretation of the registry event sequence.',
      explanation: `${missingConsideration.length} transaction(s) do not clearly expose consideration values in the returned payload.`,
      references: missingConsideration.slice(0, 4).map((transaction) => transaction.dateLabel)
    })
  }

  if (repeatedParty) {
    insights.push({
      id: 'insight-recurring-owner',
      severity: 'low',
      title: 'A recurring party appears multiple times across the registry chain',
      impact: 'Recurring participants can indicate long-term involvement, staged transfers, or linked family/business flows.',
      explanation: `${repeatedParty[0]} appears ${repeatedParty[1]} times across visible seller and buyer fields.`,
      references: [repeatedParty[0]]
    })
  }

  if (ambiguousOrUnmatched.length > 0) {
    insights.push({
      id: 'insight-linkage',
      severity: ambiguousOrUnmatched.some((transaction) => transaction.matchStatus === 'unmatched') ? 'high' : 'medium',
      title: 'Some registry rows need property-linkage review',
      impact: 'These rows may still be relevant, but they should not be treated as definitively tied to the queried parcel without corroboration.',
      explanation: `${ambiguousOrUnmatched.length} row(s) surfaced only partial, ambiguous, or mismatched survey linkage.`,
      references: ambiguousOrUnmatched.slice(0, 4).map((transaction) => transaction.surveyReferenceLabel)
    })
  }

  if (fragmentedAreas.length > 1) {
    insights.push({
      id: 'insight-area',
      severity: 'medium',
      title: 'Area values vary across surfaced registry rows',
      impact: 'Varying area references can indicate partial transfers, fragmented parcels, or inconsistent extraction.',
      explanation: `${fragmentedAreas.length} distinct area values appear across the visible transactions.`,
      references: fragmentedAreas.slice(0, 4)
    })
  }

  if (failedYears.length > 0 || emptyYears.length > 0) {
    insights.push({
      id: 'insight-coverage',
      severity: failedYears.length > 0 ? 'high' : 'medium',
      title: 'Year coverage is incomplete',
      impact: 'The visible timeline may not represent the full registry history searched by the workflow.',
      explanation:
        failedYears.length > 0
          ? `${failedYears.length} searched year(s) failed and ${emptyYears.length} returned no surfaced transactions.`
          : `${emptyYears.length} searched year(s) returned no surfaced transactions.`,
      references: [...failedYears.map((group) => `${group.year} failed`), ...emptyYears.map((group) => `${group.year} empty`)]
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: 'insight-default',
      severity: 'low',
      title: 'No immediate structural anomaly stands out in the surfaced rows',
      impact: 'Users should still review the raw evidence before drawing legal conclusions.',
      explanation: 'The current payload is relatively consistent across visible transaction references.',
      references: []
    })
  }

  return insights
}

function buildTechnicalPanel(source, identity, transactions, yearGroups) {
  const metadata = source?.rawMetadata ?? source?.metadata ?? {}
  const canonicalData = source?.canonicalData ?? metadata.canonical_data ?? metadata.canonicalData ?? {}
  const resultPayload = source?.resultPayload ?? metadata.result ?? {}
  const completenessChecks = [
    Boolean(source?.mapping && Object.keys(source.mapping).length),
    Boolean(source?.queryParams && Object.keys(source.queryParams).length),
    Boolean(resultPayload && Object.keys(resultPayload).length),
    Boolean(canonicalData && Object.keys(canonicalData).length),
    Boolean(firstDefined(source?.runDirectory, source?.run_dir, resultPayload?.run_id, canonicalData?.run_id)),
    transactions.length > 0 || yearGroups.length > 0
  ]
  const completenessScore = Math.round(
    (completenessChecks.filter(Boolean).length / completenessChecks.length) * 100
  )

  return {
    sourceRunId: source?.id ?? 'Unavailable',
    workflowRunId: source?.workflowRunId ?? source?.workflow_run ?? 'Unavailable',
    scraperRunId:
      firstDefined(source?.runDirectory, source?.run_dir, resultPayload?.run_id, canonicalData?.run_id) ??
      'Unavailable',
    workflowStep: firstDefined(source?.stepLabel, source?.workflow_step, resultPayload?.workflow_step, 'Pending'),
    scraperStatus: firstDefined(source?.status, resultPayload?.status, 'available'),
    ocrMode:
      firstDefined(source?.ocrMode, source?.captchaMode, metadata?.captcha_mode, metadata?.ocr_mode) ??
      'Not surfaced',
    captchaMode: firstDefined(source?.captchaMode, metadata?.captcha_mode, 'Not surfaced'),
    year: firstDefined(source?.year, resultPayload?.year, canonicalData?.year, identity.yearScope),
    metadataCompleteness: completenessScore,
    createdAt: firstDefined(source?.createdAt, source?.created_at, null),
    startedAt: firstDefined(source?.startedAt, source?.started_at, null),
    completedAt: firstDefined(source?.completedAt, source?.completed_at, null),
    mapping: source?.mapping ?? {},
    queryParams: source?.queryParams ?? {},
    inputPayload: source?.inputPayload ?? source?.input_payload ?? {},
    selectedLabels: resultPayload?.selected_labels ?? canonicalData?.selected_labels ?? {},
    resultPayload,
    canonicalData,
    yearStatuses: yearGroups.map((group) => ({
      year: group.year,
      status: group.status,
      transactionCount: group.transactionCount,
      suspiciousCount: group.suspiciousCount
    }))
  }
}

function buildRawExplorerTabs(source, technical) {
  const rawTransactions =
    toArray(technical.canonicalData?.all_transactions).length > 0
      ? technical.canonicalData.all_transactions
      : technical.yearStatuses

  return [
    {
      id: 'summary',
      label: 'Summary payload',
      payload: technical.resultPayload ?? {}
    },
    {
      id: 'canonical',
      label: 'Canonical data',
      payload: technical.canonicalData ?? {}
    },
    {
      id: 'transactions',
      label: 'Raw transactions',
      payload: rawTransactions
    },
    {
      id: 'metadata',
      label: 'Metadata envelope',
      payload: source?.rawMetadata ?? source?.metadata ?? {}
    }
  ]
}

export const IGR_LEGAL_TERMS = [
  {
    term: 'Sale Deed',
    meaning: 'Registered instrument used to transfer ownership through consideration.',
    significance: 'Usually the clearest transfer of title in registry history.',
    practical: 'Check whether seller-to-buyer continuity and survey references align with the queried property.'
  },
  {
    term: 'Gift Deed',
    meaning: 'Registered transfer made without sale consideration.',
    significance: 'Often appears in family or trust-linked ownership movement.',
    practical: 'Low or missing consideration may be expected, but the registry event sequence still needs document review.'
  },
  {
    term: 'Release Deed',
    meaning: 'Document used to release a claim, share, or encumbrance attached to property.',
    significance: 'Can affect co-owner rights or loan-linked obligations.',
    practical: 'Review whether it clears ownership claims or only releases a limited interest.'
  },
  {
    term: 'Mortgage',
    meaning: 'Registry event where property is used as security for a financial obligation.',
    significance: 'Indicates the property may have carried a financial charge at that point in time.',
    practical: 'Mortgage presence should be read with encumbrance and release evidence rather than in isolation.'
  },
  {
    term: 'Encumbrance',
    meaning: 'A liability, claim, or burden affecting free transfer of property.',
    significance: 'Encumbrance-related rows can change the risk profile even without changing ownership.',
    practical: 'Treat these rows as legal signals that need corroboration through supporting documents.'
  },
  {
    term: 'Conveyance',
    meaning: 'A broad legal term for an instrument transferring an interest in property.',
    significance: 'May represent transfer, assignment, or movement of a property interest.',
    practical: 'Read the type along with seller, buyer, and survey reference details before classifying it as a clean sale.'
  }
]

function mapContractTransactionToLegacyRow(transaction) {
  return {
    id: transaction.id,
    document_number: transaction.documentNumber,
    doc_no: transaction.documentNumber,
    registration_no: transaction.documentNumber,
    registration_year: transaction.registrationYear,
    year: transaction.registrationYear,
    registration_date: transaction.registrationDate,
    date: transaction.registrationDate,
    document_type: transaction.documentType,
    type: transaction.documentType,
    from_party: transaction.sellerNames.join(' / '),
    seller: transaction.sellerNames.join(' / '),
    to_party: transaction.buyerNames.join(' / '),
    buyer: transaction.buyerNames.join(' / '),
    property_description: transaction.propertyDescription,
    area: transaction.areaMentioned,
    consideration_amount: transaction.considerationAmount,
    market_value: transaction.marketValue,
    status: transaction.status,
    source_run_id: transaction.sourceRunId
  }
}

function buildContractBackedSource(source, contract) {
  const rawSource = source ?? {}
  const rawMetadata = rawSource.rawMetadata ?? rawSource.metadata ?? {}
  const rawCanonicalData =
    rawSource.canonicalData ??
    rawSource.canonical_data ??
    rawMetadata.canonical_data ??
    rawMetadata.canonicalData ??
    {}
  const rawResultPayload = rawSource.resultPayload ?? rawSource.result ?? rawMetadata.result ?? {}
  const selectedLabels = {
    district: contract.property?.district ?? '',
    taluka: contract.property?.taluka ?? '',
    village: contract.property?.village ?? ''
  }
  const legacyTransactions = contract.transactions.map((transaction) => mapContractTransactionToLegacyRow(transaction))
  const canonicalData = {
    ...rawCanonicalData,
    property_number: firstDefined(rawCanonicalData.property_number, contract.query?.propertyNumber),
    survey_number_text: firstDefined(rawCanonicalData.survey_number_text, contract.query?.surveyNumber),
    selected_labels: firstDefined(rawCanonicalData.selected_labels, selectedLabels),
    all_transactions: legacyTransactions,
    transaction_count: legacyTransactions.length,
    ownership_history:
      rawCanonicalData.ownership_history ??
      contract.transactions.map((transaction, index) => ({
        id: transaction.id ?? `ownership-${index + 1}`,
        person: transaction.buyerNames[0] ?? 'Buyer not surfaced',
        from_party: transaction.sellerNames[0] ?? 'Seller not surfaced',
        to_party: transaction.buyerNames[0] ?? 'Buyer not surfaced',
        date: transaction.registrationDate ?? 'Unavailable',
        year: transaction.registrationYear ?? 'Unknown',
        type: transaction.documentType ?? 'Registry event',
        consideration: transaction.considerationAmount ?? 'Not stated',
        area: transaction.areaMentioned ?? 'Area not stated'
      }))
  }
  const resultPayload = {
    ...rawResultPayload,
    status: firstDefined(rawResultPayload.status, rawSource.status, contract.sourceRuns?.[0]?.status, 'available'),
    transaction_count: firstDefined(rawResultPayload.transaction_count, legacyTransactions.length, 0),
    transactions: legacyTransactions,
    selected_labels: firstDefined(rawResultPayload.selected_labels, selectedLabels)
  }
  const yearEntries = contract.yearBuckets.map((bucket) => ({
    year: bucket.year,
    status: bucket.status,
    error_message: bucket.errorMessage ?? '',
    result: {
      year: bucket.year,
      status: bucket.status,
      run_id: bucket.sourceRunId,
      transaction_count: bucket.transactionCount,
      transactions: bucket.transactions.map((transaction) => mapContractTransactionToLegacyRow(transaction)),
      selected_labels: selectedLabels
    }
  }))

  return {
    ...rawSource,
    id: firstDefined(rawSource.id, contract.sourceRuns?.[0]?.id, 'igr-contract'),
    workflowRunId: firstDefined(rawSource.workflowRunId, rawSource.workflow_run, contract.workflowId),
    sourceName: firstDefined(rawSource.sourceName, rawSource.source_name, 'igr'),
    sourceLabel: firstDefined(rawSource.sourceLabel, 'Igr'),
    status: firstDefined(rawSource.status, contract.sourceRuns?.[0]?.status, 'completed'),
    rawStatus: firstDefined(rawSource.rawStatus, rawSource.status, contract.sourceRuns?.[0]?.status, 'completed'),
    stepLabel: firstDefined(rawSource.stepLabel, rawSource.workflow_step, contract.sourceRuns?.[0]?.workflowStep, 'Available'),
    workflow_step: firstDefined(rawSource.workflow_step, contract.sourceRuns?.[0]?.workflowStep, 'Available'),
    year: firstDefined(rawSource.year, contract.sourceRuns?.[0]?.sourceYear, contract.query?.yearTo),
    runDirectory: firstDefined(rawSource.runDirectory, rawSource.run_dir, contract.sourceRuns?.[0]?.runDir),
    createdAt: firstDefined(rawSource.createdAt, rawSource.created_at),
    startedAt: firstDefined(rawSource.startedAt, rawSource.started_at),
    completedAt: firstDefined(rawSource.completedAt, rawSource.completed_at),
    mapping:
      rawSource.mapping ??
      {
        district: { label: contract.property?.district ?? '' },
        taluka: { label: contract.property?.taluka ?? '' },
        village: { label: contract.property?.village ?? '' }
      },
    queryParams:
      rawSource.queryParams ??
      rawSource.query_params ??
      {
        property_number: contract.query?.propertyNumber,
        survey_number: contract.query?.surveyNumber
      },
    inputPayload:
      rawSource.inputPayload ??
      rawSource.input_payload ??
      {
        property_number: contract.query?.propertyNumber,
        year_from: contract.query?.yearFrom,
        year_to: contract.query?.yearTo
      },
    rawMetadata,
    metadata: {
      ...rawMetadata,
      canonical_data: canonicalData,
      result: resultPayload
    },
    canonicalData,
    resultPayload,
    locationLabel: [contract.property?.district, contract.property?.taluka, contract.property?.village].filter(Boolean).join(' / '),
    result_json: {
      ...(rawSource.result_json ?? rawSource.resultJson ?? {}),
      sources: {
        ...((rawSource.result_json ?? rawSource.resultJson ?? {}).sources ?? {}),
        igr: {
          status: firstDefined(contract.sourceRuns?.[0]?.status, rawSource.status, 'available'),
          years: yearEntries
        }
      }
    }
  }
}

export function buildIgrHistoryViewModel(source) {
  const contract = toIGRSearchReport(null, [source])
  const contractBackedSource = buildContractBackedSource(source, contract)
  const baseYearGroups = deriveYearGroups(contractBackedSource).sort((left, right) => Number(right.year) - Number(left.year))
  const rawTransactions = baseYearGroups.flatMap((group) => group.transactions)
  const queryReference = buildQueryReference(contractBackedSource, rawTransactions)
  const enrichedTransactions = applyTransactionIntelligence(rawTransactions, queryReference)
  const yearGroups = buildYearGroupsWithIntelligence(baseYearGroups, enrichedTransactions)
  const transactions = sortTransactionsDescending(enrichedTransactions)
  const chronologicalTransactions = sortTransactionsAscending(enrichedTransactions)
  const identity = buildPropertyIdentity(contractBackedSource, transactions, yearGroups, queryReference)
  const matchConfidence = buildMatchConfidence(transactions, queryReference, yearGroups)
  const locationVerification = buildLocationVerification(contractBackedSource, identity)
  const legalInsights = buildLegalInsights(transactions, yearGroups)
  const propertyStory = buildPropertyStory(transactions, identity, yearGroups)
  const technical = buildTechnicalPanel(contractBackedSource, identity, transactions, yearGroups)
  const sourceIssues = yearGroups.filter((group) => group.status === 'failed' || group.transactionCount === 0)

  return {
    title: 'IGR History Intelligence',
    subtitle:
      'A workflow-centric registry event sequence view backed by a stable frontend investigation contract.',
    hero: {
      ...identity,
      sourceAuthenticity:
        identity.workflowStatus === 'completed'
          ? 'Verified source-run packet'
          : identity.workflowStatus === 'partial'
            ? 'Partial registry evidence'
            : identity.workflowStatus === 'failed'
              ? 'Failed source packet'
              : 'Registry source packet',
      ocrStatus:
        technical.ocrMode === 'ocr_auto'
          ? 'OCR auto solve'
          : transactions.some((transaction) => transaction.ocrConfidence !== null && transaction.ocrConfidence !== undefined)
            ? 'OCR confidence surfaced'
            : 'OCR mode not exposed',
      sourceRunId: technical.sourceRunId,
      workflowRunId: technical.workflowRunId,
      scraperRunId: technical.scraperRunId,
      retrievalTimestamp: formatDateTimeLabel(technical.completedAt || technical.createdAt),
      completionState: toTitleCase(identity.workflowStatus),
      matchScore: matchConfidence.overallScore,
      suspiciousCount: transactions.filter((transaction) => transaction.suspiciousCount > 0).length,
      hasIncompleteYears: sourceIssues.length > 0
    },
    identity,
    queryReference,
    transactions,
    chronologicalTransactions,
    yearGroups,
    yearOptions: yearGroups.map((group) => String(group.year)),
    typeOptions: Array.from(new Set(transactions.map((transaction) => transaction.type))).sort(),
    ownerOptions: buildOwnerOptions(transactions),
    matchConfidence,
    locationVerification,
    legalInsights,
    propertyStory,
    legalTerms: IGR_LEGAL_TERMS,
    technical,
    rawExplorerTabs: buildRawExplorerTabs(contractBackedSource, technical),
    rawRecords: transactions,
    sourceIssues,
    hasSampleOnlyYears: yearGroups.some((group) => group.sampleOnly),
    hasTransactions: transactions.length > 0,
    sourceMode:
      contractBackedSource?.entries
        ? 'legacy'
        : contractBackedSource?.result_json?.sources?.igr || contractBackedSource?.resultJson?.sources?.igr
          ? 'workflow'
          : 'source-run',
    ownershipHistory: getOwnerHistoryFromCanonical(technical.canonicalData, chronologicalTransactions),
    contract
  }
}
