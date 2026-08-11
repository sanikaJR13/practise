/**
 * Shared frontend contracts and safety helpers for investigation workspaces.
 */

export const NOT_SURFACED = 'Not surfaced';

export const UNSAFE_PHRASE_RULES = [
  { pattern: /\bclean title\b/gi, replacement: 'evidence interpretation' },
  { pattern: /\btitle proof\b/gi, replacement: 'not title proof' },
  { pattern: /\bverified ownership\b/gi, replacement: 'reviewer verification required' },
  { pattern: /\btitle verification\b/gi, replacement: 'evidence interpretation' },
  { pattern: /\bownership chain\b/gi, replacement: 'registry event sequence' },
  { pattern: /\btransfer chain\b/gi, replacement: 'registry event sequence' },
  { pattern: /\bownership journey\b/gi, replacement: 'registry event sequence' },
  { pattern: /\blegal clearance\b/gi, replacement: 'reviewer verification required' },
  { pattern: /\blitigation clear\b/gi, replacement: 'reviewer verification required' },
  { pattern: /\bcertified owner\b/gi, replacement: 'extracted owner signal' },
  { pattern: /\bvalid owner\b/gi, replacement: 'extracted owner signal' },
  { pattern: /\bproven transfer\b/gi, replacement: 'transaction indicator' }
];

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asObject(value) {
  return isPlainObject(value) ? value : {};
}

export function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return value === undefined || value === null ? [] : [value];
}

export function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
}

export function compactText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).replace(/\s+/g, ' ').trim();
}

export function coerceNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value).replace(/[,%\s,]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getDisplayValue(value, fallback = NOT_SURFACED) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : fallback;
  }

  return value;
}

export function isUnsupportedClaim(text) {
  const source = compactText(text);
  if (!source) {
    return false;
  }

  return UNSAFE_PHRASE_RULES.some(({ pattern }) => {
    const probe = new RegExp(pattern.source, pattern.flags.replace('g', ''));
    return probe.test(source);
  });
}

export function sanitizeUnsafeLabel(text) {
  const source = compactText(text);
  if (!source) {
    return source;
  }

  return UNSAFE_PHRASE_RULES.reduce(
    (value, rule) => value.replace(rule.pattern, rule.replacement),
    source
  );
}

function derivePropertyRecord(raw) {
  if (!raw) {
    return {};
  }

  return asObject(
    firstDefined(
      raw.property,
      raw.property_snapshot,
      raw.canonical_property_json,
      raw.summary?.canonical_property,
      raw.result_json?.property,
      raw.resultJson?.property,
      raw.canonicalData,
      raw.canonical_data,
      raw.metadata?.canonical_data,
      raw.metadata?.canonicalData,
      raw
    )
  );
}

function buildPropertyLabel(property) {
  return sanitizeUnsafeLabel(
    firstDefined(
      property.label,
      property.propertyLabel,
      property.property_name,
      property.canonical_location,
      [
        firstDefined(property.survey_number, property.surveyNumber),
        firstDefined(property.property_number, property.propertyNumber),
        firstDefined(property.village_name, property.village, property.villageName)
      ]
        .filter(Boolean)
        .join(' / ')
    ) ?? ''
  ) || null;
}

export function toPropertySummary(raw) {
  const property = derivePropertyRecord(asObject(raw));
  const sourceMappings = toArray(
    firstDefined(property.source_mappings, property.sourceMappings, raw?.sourceMappings)
  );

  return {
    id: firstDefined(property.id, property.property_id, raw?.property_id, raw?.propertyId),
    label: buildPropertyLabel(property),
    district: firstDefined(property.district_name, property.district, property.districtName),
    taluka: firstDefined(property.taluka_name, property.taluka, property.talukaName),
    village: firstDefined(property.village_name, property.village, property.villageName),
    surveyNumber: firstDefined(
      property.survey_number,
      property.survey_number_text,
      property.surveyNumber,
      raw?.surveyNumber,
      raw?.queryParams?.survey_number,
      raw?.query_params?.survey_number
    ),
    gatNumber: firstDefined(property.gat_number, property.gatNumber, raw?.gatNumber),
    khataNumber: firstDefined(
      property.khata_number,
      property.khataNumber,
      raw?.khataNumber,
      raw?.queryParams?.khata_number,
      raw?.query_params?.khata_number
    ),
    propertyNumber: firstDefined(
      property.property_number,
      property.property_no,
      property.propertyNumber,
      raw?.propertyNumber,
      raw?.queryParams?.property_number,
      raw?.query_params?.property_number
    ),
    sourceMappings,
    lastWorkflowId: firstDefined(raw?.workflow_run, raw?.workflowRunId, raw?.workflowId, raw?.workflow_id),
    lastWorkflowStatus: firstDefined(raw?.status, raw?.workflow_status, raw?.rawStatus)
  };
}

function resolveArtifactUrl(raw, candidates) {
  for (const key of candidates) {
    const value = raw?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
}

export function toReportArtifact(raw) {
  if (!raw) {
    return {
      id: null,
      type: null,
      mimeType: null,
      fileName: null,
      downloadUrl: null,
      previewUrl: null,
      sourceRunId: null,
      reportId: null,
      previewable: false
    };
  }

  const fileName = firstDefined(
    raw.file_name,
    raw.fileName,
    raw.filename,
    raw.metadata?.original_name,
    compactText(raw.file_path).split('/').pop(),
    compactText(raw.filePath).split('/').pop()
  );
  const mimeType = firstDefined(raw.mime_type, raw.mimeType, raw.content_type, raw.contentType);
  const previewUrl = resolveArtifactUrl(raw, ['preview_url', 'previewUrl', 'url', 'file_url', 'fileUrl']);
  const downloadUrl = resolveArtifactUrl(raw, ['download_url', 'downloadUrl', 'url', 'file_url', 'fileUrl']);
  const type = firstDefined(raw.artifact_type, raw.artifactType, raw.type);

  return {
    id: firstDefined(raw.id, raw.artifact_id),
    type,
    mimeType,
    fileName,
    downloadUrl,
    previewUrl,
    sourceRunId: firstDefined(raw.source_run, raw.source_run_id, raw.sourceRunId),
    reportId: firstDefined(raw.report, raw.report_id, raw.reportId),
    previewable: Boolean(previewUrl || downloadUrl) && /pdf|image|png|jpe?g|webp/i.test(String(mimeType ?? type ?? ''))
  };
}

export function toSourceRunStatus(raw) {
  const metadata = asObject(raw?.metadata);
  const resultPayload = asObject(firstDefined(raw?.result, metadata.result, metadata.result_summary));

  return {
    id: firstDefined(raw?.id, raw?.run_id, raw?.runId),
    sourceName: firstDefined(raw?.source_name, raw?.sourceName, raw?.source, raw?.sourceType),
    sourceYear: firstDefined(raw?.source_year, raw?.year, raw?.sourceYear, resultPayload.year),
    status: firstDefined(raw?.status, raw?.workflow_status, raw?.rawStatus),
    workflowStep: firstDefined(raw?.workflow_step, raw?.step, raw?.stepLabel, resultPayload.workflow_step),
    runDir: firstDefined(raw?.run_dir, raw?.runDirectory, raw?.runDirectoryId),
    resultFound: firstDefined(
      raw?.result_found,
      raw?.resultFound,
      resultPayload.result_found,
      metadata.result_found
    ),
    errorMessage: firstDefined(raw?.error_message, raw?.errorMessage, resultPayload.error?.message),
    artifacts: toArray(raw?.artifacts).map((artifact) => toReportArtifact(artifact)),
    retryable: firstDefined(raw?.retryable, raw?.canRetry, ['failed', 'partial'].includes(String(raw?.status)))
  };
}

export function hasEvidence(item) {
  if (!item) {
    return false;
  }

  if (Array.isArray(item)) {
    return item.some((entry) => hasEvidence(entry));
  }

  return Boolean(
    firstDefined(
      item.id,
      item.rawValue,
      item.normalizedValue,
      item.citation,
      item.artifactId,
      item.sourcePath,
      item.provenance
    )
  );
}
