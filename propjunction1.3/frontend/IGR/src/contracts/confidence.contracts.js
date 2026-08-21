import { asObject, coerceNumber, compactText, firstDefined, sanitizeUnsafeLabel, toArray } from './common.contracts.js';

export function isConfidenceCapped(confidence) {
  return Boolean(
    confidence &&
      (
        confidence.highConfidenceAllowed === false ||
        (Array.isArray(confidence.caps) && confidence.caps.length > 0)
      )
  );
}

export function toConfidenceState(raw) {
  const item = asObject(raw);
  const score = coerceNumber(firstDefined(item.score, item.confidence, item.overall_score));
  const caps = toArray(firstDefined(item.caps, item.cap_reasons, item.confidence_caps)).map((entry) =>
    sanitizeUnsafeLabel(compactText(typeof entry === 'string' ? entry : entry?.reason ?? entry?.code ?? entry?.label))
  ).filter(Boolean);
  const blockers = toArray(firstDefined(item.blockers, item.blocker_reasons, item.blocking_factors)).map((entry) =>
    sanitizeUnsafeLabel(compactText(typeof entry === 'string' ? entry : entry?.reason ?? entry?.label))
  ).filter(Boolean);
  const reasons = toArray(firstDefined(item.reasons, item.explanations, item.reasoning)).map((entry) =>
    sanitizeUnsafeLabel(compactText(typeof entry === 'string' ? entry : entry?.reason ?? entry?.label ?? entry?.summary))
  ).filter(Boolean);
  const missingEvidence = toArray(firstDefined(item.missingEvidence, item.missing_evidence, item.missing_links)).map((entry) =>
    sanitizeUnsafeLabel(compactText(typeof entry === 'string' ? entry : entry?.label ?? entry?.reason ?? entry?.title))
  ).filter(Boolean);
  const explicitHighConfidenceAllowed = firstDefined(
    item.highConfidenceAllowed,
    item.high_confidence_allowed
  );

  return {
    score,
    label: sanitizeUnsafeLabel(firstDefined(item.label, item.display_label, item.summary)) || null,
    band: firstDefined(item.band, item.level, item.risk_band),
    caps,
    blockers,
    reasons,
    notLegalDecision: firstDefined(item.notLegalDecision, item.not_legal_decision) !== false,
    highConfidenceAllowed:
      explicitHighConfidenceAllowed === null
        ? caps.length === 0 && blockers.length === 0
        : Boolean(explicitHighConfidenceAllowed),
    missingEvidence,
    reviewerVerificationRequired:
      firstDefined(item.reviewerVerificationRequired, item.reviewer_verification_required) === true ||
      caps.length > 0 ||
      blockers.length > 0 ||
      missingEvidence.length > 0
  };
}
