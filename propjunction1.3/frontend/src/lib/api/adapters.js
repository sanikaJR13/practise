export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

export function toTitleCase(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

export function compactFacts(entries) {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => ({
      label,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));
}

export function getObjectEntries(value, excludedKeys = []) {
  if (!isPlainObject(value)) {
    return [];
  }
  return Object.entries(value).filter(
    ([key, entryValue]) =>
      !excludedKeys.includes(key) &&
      entryValue !== undefined &&
      entryValue !== null &&
      entryValue !== ''
  );
}

export function buildGenericSections(source, excludedKeys = []) {
  return getObjectEntries(source, excludedKeys)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return {
          id: key,
          title: toTitleCase(key),
          items: value.map((item, index) => ({
            id: item?.id ?? `${key}-${index}`,
            title: item?.title ?? item?.label ?? item?.name ?? `${toTitleCase(key)} ${index + 1}`,
            summary:
              typeof item === 'string'
                ? item
                : item?.summary ?? item?.detail ?? item?.description ?? JSON.stringify(item),
            facts: isPlainObject(item)
              ? compactFacts(
                  Object.entries(item).filter(
                    ([itemKey, itemValue]) =>
                      !['id', 'title', 'label', 'name', 'summary', 'detail', 'description'].includes(itemKey) &&
                      itemValue !== undefined &&
                      itemValue !== null &&
                      itemValue !== ''
                  )
                )
              : []
          }))
        };
      }
      return null;
    })
    .filter(Boolean);
}

export const WORKFLOW_DEFINITIONS = [
  {
    id: 'igr_only',
    title: 'IGR History',
    subtitle: 'Registry history review across the selected year range',
    accent: 'secondary',
    sourceType: 'igr',
    turnaroundMinutes: 10
  }
];

export const BHULEKH_LANGUAGE_OPTIONS = [
  { value: 'en_us', label: 'English' },
  { value: 'mr_in', label: 'Marathi' },
  { value: 'hi_in', label: 'Hindi' }
];

export function normalizeCollection(payload) {
  const items = payload?.results ?? payload?.items ?? (Array.isArray(payload) ? payload : []);
  return {
    items,
    count: payload?.count ?? items.length
  };
}

export function normalizeLocationOption(option) {
  if (!option) {
    return null;
  }
  if ('value' in option && 'label' in option && !('code' in option)) {
    return option;
  }
  return {
    value: String(firstDefined(option.code, option.value, option.label) ?? ''),
    label: String(firstDefined(option.label, option.name, option.value) ?? ''),
    code: String(firstDefined(option.code, option.value, option.label) ?? ''),
    sourceType: option.source_type ?? option.sourceType ?? null,
    raw: option
  };
}

export function normalizeProperty(property) {
  if (!property) {
    return null;
  }
  return {
    ...property,
    id: firstDefined(property.id, property.property_id),
    label:
      firstDefined(
        property.label,
        property.property_name,
        property.canonical_location,
        [property.survey_number, property.property_number, property.village_name].filter(Boolean).join(' / ')
      ) ?? '',
    districtName: firstDefined(property.district_name, property.district, property.districtName, ''),
    talukaName: firstDefined(property.taluka_name, property.taluka, property.talukaName, ''),
    villageName: firstDefined(property.village_name, property.village, property.villageName, ''),
    surveyNumber: firstDefined(property.survey_number, property.surveyNumber, ''),
    subdivisionNumber: firstDefined(property.subdivision_number, property.subdivisionNumber, ''),
    propertyNumber: firstDefined(property.property_number, property.property_no, property.propertyNumber, ''),
    canonicalLocation:
      firstDefined(
        property.canonical_location,
        [property.district_name, property.taluka_name, property.village_name].filter(Boolean).join(' / ')
      ) ?? '',
    metadata: property.metadata ?? {},
    sourceMappings: property.source_mappings ?? []
  };
}

function mapWorkflowStatus(value) {
  if (value === 'captcha_required') {
    return 'captcha_pending';
  }
  return value ?? 'queued';
}

function mapWorkflowType(value) {
  return 'igr_only';
}

function mapStepStatus(value) {
  return value ?? 'running';
}

export function normalizeArtifact(artifact) {
  if (!artifact) {
    return null;
  }
  return {
    ...artifact,
    id: artifact.id,
    title: firstDefined(artifact.title, artifact.label, artifact.file_name, `Artifact #${artifact.id}`),
    description: firstDefined(artifact.description, artifact.artifact_type, ''),
    createdAt: firstDefined(artifact.created_at, artifact.createdAt),
    artifactType: firstDefined(artifact.artifact_type, artifact.type, 'artifact'),
    fileName: firstDefined(artifact.file_name, artifact.filename, null),
    workflowId: firstDefined(artifact.workflow_run, artifact.workflow_id, null)
  };
}

export function normalizeSourceRun(sourceRun) {
  if (!sourceRun) {
    return null;
  }

  if (sourceRun.metrics || sourceRun.owners || sourceRun.entries) {
    return sourceRun;
  }

  const metadata = sourceRun.metadata ?? {};
  const mapping = metadata.mapping ?? sourceRun.mapping ?? {};
  const captcha = metadata.captcha ?? sourceRun.captcha ?? {};
  const queryParams = metadata.query_params ?? {};
  const canonicalData = firstDefined(
    sourceRun.canonicalData,
    sourceRun.canonical_data,
    metadata.canonical_data,
    metadata.canonicalData,
    null
  );
  const resultPayload = firstDefined(sourceRun.result, metadata.result, metadata.result_summary, null);
  const artifacts = toArray(sourceRun.artifacts).map((artifact) => normalizeArtifact(artifact));
  
  const coOwners = toArray(
    firstDefined(
      canonicalData?.co_owners,
      resultPayload?.record_summary?.co_owners,
      resultPayload?.co_owners,
      []
    )
  );
  const currentOwner = firstDefined(
    canonicalData?.current_owner,
    resultPayload?.record_summary?.current_owner,
    resultPayload?.current_owner,
    null
  );

  const ownerRows = currentOwner
    ? [
        {
          id: `owner-${firstDefined(sourceRun.id, sourceRun.run_id)}-primary`,
          name: currentOwner,
          share: coOwners.length ? 'Primary owner' : 'Recorded owner',
          entryType: firstDefined(canonicalData?.occupation, 'Occupant / Owner'),
          mutationNumber: firstDefined(sourceRun.id, sourceRun.run_id),
          status: 'Active'
        },
        ...coOwners.map((owner, index) => ({
          id: `owner-${firstDefined(sourceRun.id, sourceRun.run_id)}-${index + 1}`,
          name: owner,
          share: 'Co-owner',
          entryType: 'Co-owner',
          mutationNumber: firstDefined(sourceRun.id, sourceRun.run_id),
          status: 'Active'
        }))
      ]
    : [];

  return {
    ...sourceRun,
    id: firstDefined(sourceRun.id, sourceRun.run_id),
    workflowRunId: firstDefined(sourceRun.workflow_run, sourceRun.workflowRun, null),
    sourceName: firstDefined(sourceRun.source_name, sourceRun.source, sourceRun.sourceType, 'source'),
    sourceLabel: toTitleCase(firstDefined(sourceRun.source_name, sourceRun.source, 'source')),
    status: mapWorkflowStatus(firstDefined(sourceRun.status, sourceRun.workflow_status, 'queued')),
    rawStatus: firstDefined(sourceRun.status, sourceRun.workflow_status, 'queued'),
    step: firstDefined(sourceRun.workflow_step, sourceRun.step, ''),
    stepLabel: toTitleCase(firstDefined(sourceRun.workflow_step, sourceRun.step, 'Pending')),
    year: firstDefined(sourceRun.source_year, sourceRun.year),
    errorMessage: firstDefined(sourceRun.error_message, sourceRun.errorMessage, ''),
    runDirectory: firstDefined(sourceRun.run_dir, sourceRun.runDirectory, ''),
    createdAt: firstDefined(sourceRun.created_at, sourceRun.createdAt, null),
    startedAt: firstDefined(sourceRun.started_at, sourceRun.startedAt, null),
    completedAt: firstDefined(sourceRun.completed_at, sourceRun.completedAt, null),
    inputPayload: sourceRun.input_payload ?? {},
    mapping,
    captcha,
    queryParams,
    result: firstDefined(sourceRun.result, metadata.result, null),
    resultPayload,
    canonicalData,
    rawMetadata: metadata,
    artifacts,
    documentArtifact: null,
    ocrMode: firstDefined(sourceRun.ocrMode, metadata.captcha_mode, metadata.ocr_mode, null),
    captchaMode: firstDefined(sourceRun.captchaMode, metadata.captcha_mode, null),
    resultSections: buildGenericSections(sourceRun.result ?? metadata.result ?? {}, []),
    surveyNumber: firstDefined(
      canonicalData?.survey_number_text,
      resultPayload?.survey_number,
      queryParams?.survey_number,
      queryParams?.survey_no,
      null
    ),
    propertyNumber: firstDefined(canonicalData?.property_number, queryParams?.property_number, null),
    annualAssessment: firstDefined(canonicalData?.assessment, resultPayload?.record_summary?.assessment, null),
    occupancyClass: firstDefined(canonicalData?.occupation, null),
    area: null,
    metrics: [],
    owners: ownerRows
  };
}

export function normalizeWorkflow(workflow) {
  if (!workflow) {
    return null;
  }

  const workflowType = 'igr_only';
  const property = normalizeProperty(
    workflow.property && isPlainObject(workflow.property)
      ? workflow.property
      : workflow.result_json?.property
  );
  
  const sourceRuns = toArray(
    workflow.source_runs ??
      workflow.sources ??
      workflow.result_json?.sources
  )
    .map((entry) => normalizeSourceRun(entry))
    .filter(Boolean);

  const errorMessage = firstDefined(
    workflow.error_message,
    workflow.error?.message,
    workflow.error,
    ''
  );
  const status = mapWorkflowStatus(firstDefined(workflow.status, workflow.workflow_status));
  const workflowDefinition = WORKFLOW_DEFINITIONS[0];

  const propertyNumber = firstDefined(
    property?.propertyNumber,
    workflow.propertyNumber
  );
  const district = firstDefined(property?.districtName, workflow.district);
  const taluka = firstDefined(property?.talukaName, workflow.taluka);
  const village = firstDefined(property?.villageName, workflow.village);

  return {
    ...workflow,
    id: firstDefined(workflow.id, workflow.runId),
    workflowType,
    workflowLabel: workflowDefinition.title,
    workflowSubtitle: workflowDefinition.subtitle,
    status,
    rawStatus: firstDefined(workflow.status, workflow.workflow_status),
    currentStep: firstDefined(workflow.current_step, workflow.step, ''),
    currentStepLabel: toTitleCase(firstDefined(workflow.current_step, workflow.step, 'Pending')),
    progress: firstDefined(
      workflow.progress,
      workflow.completed_steps !== undefined && workflow.total_steps !== undefined
        ? `${workflow.completed_steps}/${workflow.total_steps}`
        : null,
      ''
    ),
    subjectLabel: [propertyNumber, village].filter(Boolean).join(' / ') ?? `Workflow #${workflow.id}`,
    property,
    propertyId: firstDefined(property?.id, workflow.property),
    district,
    taluka,
    village,
    sourceRuns,
    errorMessage,
    created_at: workflow.created_at,
    completed_at: workflow.completed_at
  };
}
