import {
  asObject,
  compactText,
  firstDefined,
  sanitizeUnsafeLabel,
  toArray
} from './common.contracts.js';

const ALLOWED_EVIDENCE_STATUSES = new Set([
  'extracted',
  'interpreted',
  'rule_approved',
  'ai_suggested',
  'reviewer_required',
  'unsupported',
  'missing'
]);

function normalizeEvidenceStatus(raw) {
  const explicit = compactText(raw?.status ?? raw?.evidence_status).toLowerCase().replace(/\s+/g, '_');
  if (ALLOWED_EVIDENCE_STATUSES.has(explicit)) {
    return explicit;
  }

  if (raw?.unsupported === true) {
    return 'unsupported';
  }

  if (raw?.reviewer_required === true || raw?.reviewerRequired === true) {
    return 'reviewer_required';
  }

  if (firstDefined(raw?.semanticMeaning, raw?.semantic_meaning, raw?.meaning)) {
    return 'interpreted';
  }

  if (firstDefined(raw?.rawValue, raw?.raw_value, raw?.value, raw?.text) !== null) {
    return 'extracted';
  }

  return 'missing';
}

export function normalizeEvidenceRefs(value) {
  return toArray(value).map((entry, index) => {
    if (typeof entry === 'string') {
      return {
        id: `evidence-ref-${index + 1}`,
        label: sanitizeUnsafeLabel(entry),
        citation: sanitizeUnsafeLabel(entry),
        sourcePath: null,
        artifactId: null,
        pageNumber: null
      };
    }

    const item = asObject(entry);
    return {
      id: firstDefined(item.id, item.code, item.ref, `evidence-ref-${index + 1}`),
      label: sanitizeUnsafeLabel(
        firstDefined(item.label, item.title, item.citation, item.path, item.code, 'Evidence reference')
      ),
      citation: firstDefined(item.citation, item.title, item.label),
      sourcePath: firstDefined(item.source_path, item.sourcePath, item.path),
      artifactId: firstDefined(item.artifact_id, item.artifactId),
      pageNumber: firstDefined(item.page_number, item.pageNumber)
    };
  });
}

export function toEvidenceItem(raw) {
  if (typeof raw === 'string') {
    return {
      id: null,
      sourceType: null,
      sourceName: null,
      sourceSection: null,
      sourceField: null,
      sourcePath: null,
      rawValue: raw,
      normalizedValue: raw,
      semanticMeaning: null,
      citation: raw,
      artifactId: null,
      pageNumber: null,
      highlightRegion: null,
      confidence: null,
      status: 'extracted',
      trustLevel: null,
      provenance: null
    };
  }

  const item = asObject(raw);
  const rawValue = firstDefined(item.rawValue, item.raw_value, item.value, item.text, item.original_text, item.raw_text);
  const normalizedValue = firstDefined(item.normalizedValue, item.normalized_value, item.display_value, item.interpreted_value, rawValue);

  return {
    id: firstDefined(item.id, item.code, item.path),
    sourceType: firstDefined(item.source_type, item.sourceType, item.type),
    sourceName: firstDefined(item.source_name, item.sourceName, item.source),
    sourceSection: firstDefined(item.source_section, item.sourceSection, item.section),
    sourceField: firstDefined(item.source_field, item.sourceField, item.field),
    sourcePath: firstDefined(item.source_path, item.sourcePath, item.path),
    rawValue,
    normalizedValue,
    semanticMeaning: sanitizeUnsafeLabel(
      firstDefined(item.semanticMeaning, item.semantic_meaning, item.meaning, item.interpretation)
    ) || null,
    citation: firstDefined(item.citation, item.citation_text, item.reference, item.source_ref),
    artifactId: firstDefined(item.artifact_id, item.artifactId),
    pageNumber: firstDefined(item.page_number, item.pageNumber, item.page),
    highlightRegion: firstDefined(item.highlight_region, item.highlightRegion, item.bounding_box, item.rect),
    confidence: firstDefined(item.confidence, item.score) ?? null,
    status: normalizeEvidenceStatus(item),
    trustLevel: firstDefined(item.trust_level, item.trustLevel, item.provenance_tier),
    provenance: firstDefined(item.provenance, item.source_meta, item.audit)
  };
}
