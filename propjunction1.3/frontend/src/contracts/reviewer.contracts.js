import { asObject, compactText, firstDefined, sanitizeUnsafeLabel, toArray } from './common.contracts.js';

const ALLOWED_REVIEWER_STATUSES = new Set(['pending', 'in_review', 'completed', 'blocked', 'not_required']);

function normalizeReviewerStatus(raw) {
  const explicit = compactText(raw?.status).toLowerCase().replace(/\s+/g, '_');
  if (ALLOWED_REVIEWER_STATUSES.has(explicit)) {
    return explicit;
  }

  if (raw?.completed === true) {
    return 'completed';
  }

  if (raw?.blocked === true) {
    return 'blocked';
  }

  if (raw?.required === false) {
    return 'not_required';
  }

  return 'pending';
}

export function hasReviewerAction(item) {
  if (!item) {
    return false;
  }

  if (Array.isArray(item)) {
    return item.some((entry) => hasReviewerAction(entry));
  }

  return Boolean(firstDefined(item.label, item.reason, item.requiredEvidence?.length, item.sourceRefs?.length));
}

export function toReviewerAction(raw) {
  if (typeof raw === 'string') {
    return {
      id: null,
      priority: null,
      category: null,
      label: sanitizeUnsafeLabel(raw),
      reason: null,
      requiredEvidence: [],
      sourceRefs: [],
      relatedFindingCode: null,
      status: 'pending',
      assignee: null,
      dueState: null
    };
  }

  const item = asObject(raw);
  return {
    id: firstDefined(item.id, item.code, item.action_id),
    priority: firstDefined(item.priority, item.severity, item.level),
    category: firstDefined(item.category, item.group, item.type),
    label: sanitizeUnsafeLabel(
      firstDefined(item.label, item.title, item.action, item.name, item.code, 'Reviewer action')
    ),
    reason: sanitizeUnsafeLabel(
      firstDefined(item.reason, item.description, item.guidance, item.summary, item.detail)
    ) || null,
    requiredEvidence: toArray(firstDefined(item.required_evidence, item.requiredEvidence)).map((entry) => String(entry)),
    sourceRefs: toArray(firstDefined(item.source_refs, item.sourceRefs, item.references)),
    relatedFindingCode: firstDefined(item.related_finding_code, item.relatedFindingCode, item.finding_code),
    status: normalizeReviewerStatus(item),
    assignee: firstDefined(item.assignee, item.owner, item.reviewer),
    dueState: firstDefined(item.due_state, item.dueState, item.deadline_state)
  };
}
