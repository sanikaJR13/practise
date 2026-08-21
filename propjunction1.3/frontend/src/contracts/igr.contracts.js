import {
  asObject,
  compactText,
  firstDefined,
  sanitizeUnsafeLabel,
  toArray,
  toPropertySummary,
  toSourceRunStatus
} from './common.contracts.js';
import { toConfidenceState } from './confidence.contracts.js';
import { normalizeEvidenceRefs, toEvidenceItem } from './evidence.contracts.js';
import { toReviewerAction } from './reviewer.contracts.js';

function extractRuns(rawWorkflow, rawSourceRuns) {
  const directRuns = toArray(rawSourceRuns);
  if (directRuns.length > 0) {
    return directRuns;
  }

  return toArray(
    firstDefined(rawWorkflow?.sourceRuns, rawWorkflow?.source_runs, rawWorkflow?.sources?.igr)
  );
}

function pickWorkflowIgrPayload(rawWorkflow) {
  return asObject(
    firstDefined(
      rawWorkflow?.result_json?.sources?.igr,
      rawWorkflow?.resultJson?.sources?.igr,
      rawWorkflow?.sources?.igr
    )
  );
}

function pickRunCanonical(run) {
  return asObject(
    firstDefined(run?.canonicalData, run?.canonical_data, run?.metadata?.canonical_data, run?.metadata?.canonicalData)
  );
}

function pickRunResult(run) {
  return asObject(firstDefined(run?.resultPayload, run?.result, run?.metadata?.result));
}

function parseTransaction(rawTransaction, run, yearValue, index) {
  const item = asObject(rawTransaction);
  const parties = compactText(firstDefined(item.parties, item.partiesLabel));
  const [partySeller = '', partyBuyer = ''] = parties.split('->').map((part) => compactText(part));
  const sellerNames = toArray(
    firstDefined(item.seller_names, item.sellers, item.from_party, item.fromParty, item.seller, partySeller)
  ).filter(Boolean).map((entry) => String(entry));
  const buyerNames = toArray(
    firstDefined(item.buyer_names, item.buyers, item.to_party, item.toParty, item.buyer, item.purchaser_name, partyBuyer)
  ).filter(Boolean).map((entry) => String(entry));
  const documentNumber = firstDefined(item.document_number, item.doc_no, item.documentNo, item.registration_no);
  const registrationYear = firstDefined(item.registration_year, item.year, yearValue);
  const registrationDate = firstDefined(item.registration_date, item.date, item.RDate, item.document_date);
  const propertyDescription = firstDefined(
    item.property_description,
    item.PropertyDescription,
    item.description,
    item.details
  );
  const sourceRunId = firstDefined(run?.id, run?.run_id, run?.runDirectory);

  return {
    id: firstDefined(item.id, documentNumber, `igr-transaction-${sourceRunId ?? 'run'}-${index + 1}`),
    documentNumber,
    registrationYear,
    registrationDate,
    documentType: sanitizeUnsafeLabel(
      firstDefined(item.document_type, item.doc_type, item.type, item.DName, 'Registry event')
    ),
    sroName: firstDefined(item.sro_name, item.sroName),
    sroCode: firstDefined(item.sro_code, item.sroCode),
    sellerNames,
    buyerNames,
    propertyDescription,
    areaMentioned: firstDefined(item.area_mentioned, item.area),
    considerationAmount: firstDefined(item.consideration_amount, item.consideration),
    marketValue: firstDefined(item.market_value, item.marketValue),
    status: firstDefined(item.status, run?.status, 'available'),
    sourceRunId,
    evidenceRefs: normalizeEvidenceRefs([
      {
        id: `${sourceRunId ?? 'run'}-transaction-${index + 1}`,
        label: documentNumber ? `Document ${documentNumber}` : `Registry event ${index + 1}`,
        citation: propertyDescription,
        source_path: `transactions[${index}]`
      }
    ])
  };
}

function collectTransactions(rawWorkflow, runs) {
  const workflowPayload = pickWorkflowIgrPayload(rawWorkflow);
  const workflowYears = toArray(workflowPayload.years);

  if (workflowYears.length > 0) {
    const yearBuckets = workflowYears.map((yearEntry, index) => {
      const payload = asObject(yearEntry?.result);
      const transactions = toArray(firstDefined(payload.transactions, payload.sample_transactions)).map(
        (transaction, transactionIndex) =>
          parseTransaction(transaction, yearEntry, firstDefined(yearEntry?.year, payload.year), transactionIndex)
      );

      return {
        id: `igr-year-${firstDefined(yearEntry?.year, index)}`,
        year: firstDefined(yearEntry?.year, payload.year),
        status: firstDefined(yearEntry?.status, payload.status, workflowPayload.status, 'available'),
        transactionCount: firstDefined(payload.transaction_count, transactions.length, 0),
        sourceRunId: firstDefined(payload.run_id, yearEntry?.run_id),
        resultFound: firstDefined(payload.result_found, transactions.length > 0),
        errorMessage: firstDefined(yearEntry?.error_message, payload.error?.message),
        transactions
      };
    });

    return {
      yearBuckets,
      transactions: yearBuckets.flatMap((bucket) => bucket.transactions)
    };
  }

  const legacyEntries = runs.flatMap((run) => toArray(run?.entries).map((entry) => ({ run, entry })));
  if (legacyEntries.length > 0) {
    const grouped = new Map();

    legacyEntries.forEach(({ run, entry }, index) => {
      const year = firstDefined(entry?.year, run?.year, 'Unknown');
      if (!grouped.has(year)) {
        grouped.set(year, []);
      }

      grouped.get(year).push(parseTransaction(entry, run, year, index));
    });

    const yearBuckets = Array.from(grouped.entries()).map(([year, transactions], index) => ({
      id: `igr-year-${firstDefined(year, index)}`,
      year,
      status: 'completed',
      transactionCount: transactions.length,
      sourceRunId: firstDefined(runs[0]?.id, runs[0]?.run_id),
      resultFound: transactions.length > 0,
      errorMessage: null,
      transactions
    }));

    return {
      yearBuckets,
      transactions: yearBuckets.flatMap((bucket) => bucket.transactions)
    };
  }

  const yearBuckets = runs.map((run, index) => {
    const canonical = pickRunCanonical(run);
    const resultPayload = pickRunResult(run);
    const rawTransactions = toArray(
      firstDefined(
        canonical.all_transactions,
        canonical.transactions,
        resultPayload.transactions,
        resultPayload.sample_transactions
      )
    );
    const transactions = rawTransactions.map((transaction, transactionIndex) =>
      parseTransaction(transaction, run, firstDefined(run?.year, resultPayload.year), transactionIndex)
    );

    return {
      id: `igr-year-${firstDefined(run?.year, resultPayload.year, index)}`,
      year: firstDefined(run?.year, resultPayload.year),
      status: firstDefined(run?.status, resultPayload.status, 'available'),
      transactionCount: firstDefined(resultPayload.transaction_count, transactions.length, 0),
      sourceRunId: firstDefined(run?.id, run?.run_id),
      resultFound: firstDefined(run?.resultFound, resultPayload.result_found, transactions.length > 0),
      errorMessage: firstDefined(run?.errorMessage, run?.error_message, resultPayload.error?.message),
      transactions
    };
  });

  return {
    yearBuckets,
    transactions: yearBuckets.flatMap((bucket) => bucket.transactions)
  };
}

function buildPartySignals(transactions) {
  const counts = new Map();

  transactions.forEach((transaction) => {
    [...transaction.sellerNames, ...transaction.buyerNames].forEach((name) => {
      const key = compactText(name);
      if (!key) {
        return;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([name, count]) => ({
      name,
      count,
      reviewerRequired: count >= 3
    }))
    .sort((left, right) => right.count - left.count);
}

function buildPropertyLinkageSignals(transactions, property) {
  return transactions.slice(0, 20).map((transaction) => {
    const description = compactText(transaction.propertyDescription).toLowerCase();
    const survey = compactText(property.surveyNumber).toLowerCase();
    const propertyNumber = compactText(property.propertyNumber).toLowerCase();
    const matched =
      (survey && description.includes(survey)) ||
      (propertyNumber && description.includes(propertyNumber));

    return {
      id: transaction.id,
      label: transaction.documentNumber
        ? `Document ${transaction.documentNumber}`
        : `Registry event ${transaction.id}`,
      status: matched ? 'supported' : 'reviewer_required',
      summary: matched
        ? 'Visible registry activity references the queried property description.'
        : 'Property linkage is not explicit in the surfaced registry description.',
      evidenceRefs: transaction.evidenceRefs
    };
  });
}

function buildIgrEvidenceItems(transactions) {
  return transactions.flatMap((transaction) => [
    toEvidenceItem({
      id: `${transaction.id}-document`,
      sourceType: 'igr',
      sourceName: 'registry event sequence',
      sourceSection: 'transaction',
      sourceField: 'documentNumber',
      sourcePath: `transactions.${transaction.id}.documentNumber`,
      rawValue: transaction.documentNumber,
      normalizedValue: transaction.documentNumber,
      citation: transaction.documentNumber ? `Document ${transaction.documentNumber}` : null,
      status: transaction.documentNumber ? 'extracted' : 'missing',
      provenance: { sourceRunId: transaction.sourceRunId }
    }),
    toEvidenceItem({
      id: `${transaction.id}-property-description`,
      sourceType: 'igr',
      sourceName: 'registry event sequence',
      sourceSection: 'transaction',
      sourceField: 'propertyDescription',
      sourcePath: `transactions.${transaction.id}.propertyDescription`,
      rawValue: transaction.propertyDescription,
      normalizedValue: transaction.propertyDescription,
      citation: transaction.propertyDescription,
      status: transaction.propertyDescription ? 'extracted' : 'missing',
      provenance: { sourceRunId: transaction.sourceRunId }
    })
  ]);
}

export function toIGRSearchReport(rawWorkflow, rawSourceRuns) {
  const runs = extractRuns(rawWorkflow, rawSourceRuns);
  const property = toPropertySummary(rawWorkflow ?? runs[0] ?? {});
  const sourceRuns = runs.map((run) => toSourceRunStatus(run));
  const { yearBuckets, transactions } = collectTransactions(rawWorkflow, runs);
  const failedYears = yearBuckets.filter((bucket) => String(bucket.status).toLowerCase() === 'failed');
  const emptyYears = yearBuckets.filter((bucket) => bucket.transactionCount === 0 && String(bucket.status).toLowerCase() !== 'failed');
  const warnings = [
    ...failedYears.map((bucket) => `Registry event sequence failed for ${bucket.year}.`),
    ...emptyYears.map((bucket) => `No registry event surfaced for ${bucket.year}.`)
  ];
  const confidence = toConfidenceState({
    confidence: firstDefined(rawWorkflow?.confidence, rawWorkflow?.summary?.confidence),
    cap_reasons: warnings,
    missing_evidence: warnings,
    not_legal_decision: true
  });
  const evidenceItems = buildIgrEvidenceItems(transactions);
  const reviewerActions = [
    ...failedYears.map((bucket) =>
      toReviewerAction({
        id: `igr-failed-${bucket.year}`,
        priority: 'high',
        category: 'missing_evidence',
        label: `Review failed registry year ${bucket.year}`,
        reason: bucket.errorMessage || 'Registry event sequence did not complete for this year.',
        requiredEvidence: ['Registry search rerun', 'manual document review']
      })
    ),
    ...emptyYears.map((bucket) =>
      toReviewerAction({
        id: `igr-empty-${bucket.year}`,
        priority: 'medium',
        category: 'missing_evidence',
        label: `Review empty registry year ${bucket.year}`,
        reason: 'No registry event surfaced for this searched year.',
        requiredEvidence: ['Registry search coverage validation']
      })
    )
  ];

  return {
    workflowId: firstDefined(rawWorkflow?.id, rawWorkflow?.workflow_id, runs[0]?.workflowRunId, runs[0]?.workflow_run),
    property,
    query: {
      yearFrom: firstDefined(rawWorkflow?.year_from, rawWorkflow?.yearFrom),
      yearTo: firstDefined(rawWorkflow?.year_to, rawWorkflow?.yearTo),
      propertyNumber: firstDefined(
        rawWorkflow?.summary?.sources_config?.igr?.property_number,
        runs[0]?.queryParams?.property_number,
        property.propertyNumber
      ),
      surveyNumber: property.surveyNumber,
      village: property.village
    },
    sourceRuns,
    yearBuckets,
    transactions,
    eventTimeline: transactions
      .slice()
      .sort((left, right) => String(left.registrationDate ?? left.registrationYear).localeCompare(String(right.registrationDate ?? right.registrationYear)))
      .map((transaction, index) => ({
        id: transaction.id,
        label: `Registry event sequence ${index + 1}`,
        status: transaction.status,
        timestamp: firstDefined(transaction.registrationDate, transaction.registrationYear),
        source: transaction.sourceRunId,
        details: sanitizeUnsafeLabel(
          `${transaction.documentType}${transaction.documentNumber ? ` / ${transaction.documentNumber}` : ''}`
        ),
        confidenceImpact: null,
        evidenceRefs: transaction.evidenceRefs
      })),
    partySignals: buildPartySignals(transactions),
    propertyLinkageSignals: buildPropertyLinkageSignals(transactions, property),
    failedYears: failedYears.map((bucket) => bucket.year),
    emptyYears: emptyYears.map((bucket) => bucket.year),
    warnings,
    confidence,
    evidenceItems,
    reviewerActions,
    audit: {
      rawPayloadAvailable: Boolean(transactions.length || yearBuckets.length),
      provenance: {
        sourceType: 'igr',
        sourceRunIds: sourceRuns.map((run) => run.id).filter(Boolean)
      },
      rawSourceRef: {
        workflow: rawWorkflow ?? null,
        sourceRuns: runs
      }
    }
  };
}
