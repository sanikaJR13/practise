import { ChevronDown, ExternalLink, FileText, Leaf, MapPinned, Scale, ScrollText, UsersRound, Waypoints } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

const SECTION_META = {
  property: {
    title: 'Property',
    icon: MapPinned,
    description: 'Location and parcel identifiers surfaced from the 7/12 packet.'
  },
  ownership: {
    title: 'Ownership',
    icon: UsersRound,
    description: 'Extracted owner signals, occupant names, and divided area indicators. Reviewer verification required.'
  },
  area: {
    title: 'Area',
    icon: Scale,
    description: 'Area statements and assessment values as visible record information.'
  },
  itarHakk: {
    title: 'Itar Hakk / Other Rights',
    icon: ScrollText,
    description: 'Other rights clauses and semantic interpretation cues.'
  },
  crop: {
    title: 'Crop & Usage',
    icon: Leaf,
    description: 'Cultivation and usage rows where available from current evidence.'
  },
  mutation: {
    title: 'Mutation References',
    icon: Waypoints,
    description: 'Mutation references visible. Full Ferfar continuity verification unavailable in current version.'
  },
  registry: {
    title: 'Registry Summary',
    icon: FileText,
    description: 'Registry indicators linked to this evidence packet when surfaced.'
  }
};

function display(value, fallback = 'Not surfaced') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value.length ? value.filter(Boolean).join(', ') : fallback;
  }

  if (typeof value === 'object') {
    return fallback;
  }

  return String(value);
}

function humanize(value) {
  const text = String(value ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }

  if (text === text.toUpperCase() || /_/.test(String(value ?? ''))) {
    return text.toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
  }

  return text;
}

function signalLabel(signal) {
  return humanize(display(signal?.label ?? signal?.title ?? signal?.code ?? signal?.category ?? signal?.type, 'Review indicator'));
}

function signalSummary(signal) {
  return display(
    signal?.summary ??
      signal?.detail ??
      signal?.reason ??
      signal?.description ??
      signal?.semanticMeaning,
    'Reviewer verification required from current evidence.'
  );
}

function signalEvidence(signal, sectionId) {
  return {
    id: signal?.id ?? signal?.code ?? `${sectionId}-${signalLabel(signal)}`,
    sourceType: signal?.sourceType ?? 'semantic',
    sourceName: signal?.sourceName ?? '7/12 investigation signal',
    sourceSection: sectionId,
    sourceField: signal?.code ?? signalLabel(signal),
    rawValue: signal?.rawValue ?? signalSummary(signal),
    normalizedValue: signalLabel(signal),
    semanticMeaning: signal?.semanticMeaning ?? signalSummary(signal),
    citation: signal?.citation ?? signal?.evidenceRefs?.[0]?.citation ?? signal?.sourcePath,
    confidence: signal?.confidence ?? null,
    status: signal?.reviewerRequired ? 'reviewer_required' : 'interpreted'
  };
}

function registrySignalLabel(signal) {
  return signalLabel({
    label:
    signal?.label ??
      signal?.title ??
      signal?.type ??
      signal?.category ??
      signal?.code
  }) || 'Linked registry review item';
}

function registrySignalSummary(signal) {
  return display(
    signal?.summary ??
      signal?.detail ??
      signal?.reason ??
      signal?.description ??
      signal?.message,
    'Reviewer verification required from linked registry evidence.'
  );
}

function toRows(entries) {
  return entries
    .filter((entry) => entry && entry.value !== undefined && entry.value !== null && entry.value !== '')
    .map((entry) => ({
      ...entry,
      value: display(entry.value)
    }));
}

function evidenceFor(detail, section, field, fallback) {
  return (
    detail?.evidenceItems?.find((item) => item.sourceSection === section && (!field || item.sourceField === field)) ??
    fallback ??
    null
  );
}

function buildEvidenceFromRow(row, sectionId) {
  return {
    id: row.id ?? `${sectionId}-${row.label}`,
    sourceType: 'bhulekh',
    sourceName: '7/12 extract',
    sourceSection: sectionId,
    sourceField: row.label,
    rawValue: row.value,
    normalizedValue: row.value,
    semanticMeaning: row.note ?? row.description ?? null,
    citation: row.citation ?? `7/12 ${sectionId} section`,
    confidence: row.confidence ?? null,
    status: row.status ?? 'extracted'
  };
}

function SectionCard({ id, rows, detail, signals = [], onEvidenceSelect }) {
  const meta = SECTION_META[id];
  const Icon = meta.icon;

  return (
    <Card className="overflow-hidden border border-outline-variant/16 bg-surface-container-lowest shadow-[0_18px_42px_rgba(3,22,50,0.05)]">
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-6 py-5">
          <div className="flex min-w-0 items-start gap-4">
            <div className="rounded-[1rem] bg-primary-fixed/35 p-3 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="section-eyebrow">{id === 'itarHakk' ? 'Other Rights' : id}</p>
              <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-primary">{meta.title}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">{meta.description}</p>
            </div>
          </div>
          <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-open:rotate-180" />
        </summary>

        <div className="border-t border-outline-variant/12 px-6 py-5">
          {rows.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map((row) => {
                const rowEvidence = row.evidence ?? evidenceFor(detail, row.sourceSection, row.sourceField);
                return (
                  <button
                    key={row.id ?? row.label}
                    type="button"
                    className="rounded-[1.15rem] border border-outline-variant/14 bg-surface-container-low px-4 py-4 text-left transition hover:border-primary/25 hover:bg-white hover:shadow-[0_12px_24px_rgba(3,22,50,0.04)]"
                    onClick={() => onEvidenceSelect?.(rowEvidence ?? buildEvidenceFromRow(row, id))}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                          {row.label}
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-primary">{row.value}</p>
                      </div>
                      <ExternalLink className="mt-1 h-4 w-4 text-on-surface-variant" />
                    </div>
                    {row.note ? <p className="mt-2 text-xs leading-5 text-on-surface-variant">{row.note}</p> : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[1.15rem] border border-dashed border-outline-variant/20 bg-surface-container-low p-5 text-sm leading-6 text-on-surface-variant">
              Not available from current evidence.
            </div>
          )}

          {signals.length ? (
            <div className="mt-5 rounded-[1.15rem] border border-outline-variant/14 bg-surface-container-low p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Semantic Expansion</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {signals.map((signal) => (
                  <button
                    key={signal.id ?? signal.code ?? signalLabel(signal)}
                    type="button"
                    className="rounded-full bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
                    onClick={() =>
                      onEvidenceSelect?.({
                        id: signal.id ?? signal.code,
                        sourceType: 'semantic',
                        sourceName: '7/12 semantic signal',
                        sourceSection: id,
                        sourceField: signal.code ?? signalLabel(signal),
                        rawValue: signal.rawValue ?? signalLabel(signal),
                        normalizedValue: signalLabel(signal),
                        semanticMeaning: signal.semanticMeaning ?? signalSummary(signal),
                        citation: signal.evidenceRefs?.[0]?.citation ?? signal.sourcePath,
                        confidence: signal.confidence,
                        status: signal.reviewerRequired ? 'reviewer_required' : 'interpreted'
                      })
                    }
                  >
                    {signalLabel(signal)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </Card>
  );
}

function matchesSignal(signal, pattern) {
  return pattern.test(
    [
      signal?.label,
      signal?.title,
      signal?.code,
      signal?.category,
      signal?.type,
      signal?.summary,
      signal?.detail,
      signal?.semanticMeaning,
      signal?.reason
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function uniqueSignals(signals) {
  const seen = new Set();
  return signals.filter((signal) => {
    const key = signal?.id ?? signal?.code ?? signalLabel(signal);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildSections(detail, riskReport, aiInvestigation) {
  const facts = detail?.extractedFacts ?? {};
  const identity = facts.propertyIdentity ?? {};
  const ownership = facts.ownership ?? {};
  const area = facts.area ?? {};
  const rights = facts.rightsAndMutation ?? {};
  const cropRows = facts.cropTable ?? [];
  const investigationSignals = uniqueSignals([
    ...(detail?.semanticSignals ?? []),
    ...(detail?.riskSignals ?? []),
    ...(riskReport?.keyFindings ?? []),
    ...(riskReport?.semanticSignals ?? []),
    ...(aiInvestigation?.findings ?? []),
    ...(aiInvestigation?.keyFindings ?? []),
    ...(aiInvestigation?.semanticExplanations ?? [])
  ]);
  const ownershipSignals = investigationSignals.filter((signal) =>
    matchesSignal(signal, /owner|occupant|institution|religious|deity|trust|inam|co[- ]?operative|society/i)
  );
  const itarHakkSignals = investigationSignals.filter((signal) =>
    matchesSignal(signal, /itar|other rights|charge|loan|mortgage|bank|encumbrance|boja|agreement|society|secured|debt/i)
  );
  const registrySignals = [
    ...(riskReport?.igrSignals ?? []),
    ...(riskReport?.crossSourceMismatches ?? [])
  ];

  return [
    {
      id: 'property',
      rows: toRows([
        { label: 'District', value: identity.district, sourceSection: 'property', sourceField: 'district' },
        { label: 'Taluka', value: identity.taluka, sourceSection: 'property', sourceField: 'taluka' },
        { label: 'Village', value: identity.village, sourceSection: 'property', sourceField: 'village' },
        { label: 'Survey Number', value: identity.surveyNumber, sourceSection: 'property', sourceField: 'surveyNumber' },
        { label: 'Subdivision / Hissa', value: identity.subdivisionNumber },
        { label: 'Khata Number', value: identity.khataNumber },
        { label: 'Record Date', value: identity.recordDate },
        { label: 'Extract Date', value: identity.extractDate }
      ])
    },
    {
      id: 'ownership',
      rows: toRows([
        {
          label: 'Extracted Owner Signals',
          value: ownership.owners,
          sourceSection: 'ownership',
          sourceField: 'owners',
          note: 'Names are extracted signals from the visible record and require reviewer verification.'
        },
        {
          label: 'Occupant Names',
          value: ownership.occupantNames,
          note: 'Occupant entries may differ from legal conclusions outside this extract.'
        },
        { label: 'Khata Numbers', value: ownership.khataNumbers },
        {
          label: 'Ownership Semantic Indicators',
          value: ownershipSignals.map(signalLabel),
          note: 'These are interpretation indicators, not extracted owner names.',
          evidence: ownershipSignals[0] ? signalEvidence(ownershipSignals[0], 'ownership') : null
        },
        {
          label: 'Divided Area Indicators',
          value: ownership.dividedAreas,
          note: 'Area division indicators are evidence cues, not standalone legal conclusions.'
        },
        { label: 'Ownership Notes', value: ownership.ownershipNotes }
      ])
    },
    {
      id: 'area',
      rows: toRows([
        { label: 'Total Area', value: area.totalArea, sourceSection: 'area', sourceField: 'totalArea' },
        { label: 'Cultivable Area', value: area.cultivableArea },
        { label: 'Pot Kharab Area', value: area.potKharabArea },
        { label: 'Net Area', value: area.netArea },
        { label: 'Area Unit', value: area.unit },
        { label: 'Assessment', value: area.assessment },
        { label: 'Area Notes', value: area.areaNotes }
      ])
    },
    {
      id: 'itarHakk',
      rows: toRows([
        { label: 'Other Rights Text', value: rights.otherRightsRaw, sourceSection: 'itarHakk', sourceField: 'otherRightsRaw' },
        { label: 'Other Right Entries', value: rights.otherRightEntries },
        { label: 'Mapped Clauses', value: rights.mappedClauses },
        { label: 'Pending Mutation Indicator', value: rights.pendingMutation },
        {
          label: 'Detected Itar Hakk Indicators',
          value: itarHakkSignals.map(signalLabel),
          note: 'Indicator surfaced by semantic or risk analysis; raw clause text may still be unavailable from current extraction.',
          evidence: itarHakkSignals[0] ? signalEvidence(itarHakkSignals[0], 'itarHakk') : null
        },
        {
          label: 'Reviewer Interpretation',
          value: itarHakkSignals.map(signalSummary).filter((item) => item !== 'Reviewer verification required from current evidence.'),
          note: 'Use the source document and supporting evidence before relying on any Itar Hakk interpretation.',
          evidence: itarHakkSignals[0] ? signalEvidence(itarHakkSignals[0], 'itarHakk') : null
        }
      ]),
      signals: itarHakkSignals
    },
    {
      id: 'crop',
      rows: cropRows.length
        ? cropRows.slice(0, 8).map((row, index) => ({
            id: `crop-${index + 1}`,
            label: row?.season ?? row?.crop ?? row?.label ?? `Crop row ${index + 1}`,
            value: display(row?.crop ?? row?.usage ?? row?.value ?? row?.summary),
            note: display(row?.area ?? row?.year ?? row?.remarks, '')
          }))
        : []
    },
    {
      id: 'mutation',
      rows: toRows([
        { label: 'Last Mutation Number', value: rights.lastMutationNumber },
        { label: 'Last Mutation Date', value: rights.lastMutationDate },
        {
          label: 'Old Mutation Numbers',
          value: rights.oldMutationNumbers,
          sourceSection: 'mutationRefs',
          sourceField: 'mutationReferences',
          note: 'Mutation references visible. Full Ferfar continuity verification unavailable in current version.'
        },
        {
          label: 'Reviewer Notice',
          value: rights.mutationReferenceNotice,
          note: 'Reviewer verification required before relying on mutation continuity.'
        }
      ])
    },
    {
      id: 'registry',
      rows: registrySignals.length
        ? registrySignals.slice(0, 6).map((signal, index) => ({
            id: signal.id ?? `registry-${index + 1}`,
            label: registrySignalLabel(signal),
            value: registrySignalSummary(signal),
            note: signal.severity ? `Severity: ${signal.severity}` : null,
            evidence: {
              id: signal.id ?? `registry-${index + 1}`,
              sourceType: 'risk',
              sourceName: 'registry summary',
              sourceSection: 'registrySummary',
              sourceField: registrySignalLabel(signal),
              rawValue: registrySignalSummary(signal),
              normalizedValue: registrySignalLabel(signal),
              semanticMeaning: registrySignalSummary(signal),
              citation: signal.evidenceRefs?.[0]?.citation,
              status: 'interpreted'
            }
          }))
        : [
            {
              id: 'registry-not-surfaced',
              label: 'Registry Indicators',
              value: 'Not available from current evidence',
              note: 'Run or review linked IGR evidence where registry indicators are required.'
            }
          ]
    }
  ];
}

export function GroupedParsedIntelligence({ detail, riskReport, aiInvestigation, onEvidenceSelect }) {
  const sections = buildSections(detail, riskReport, aiInvestigation);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-eyebrow">Parsed Intelligence</p>
          <h2 className="mt-2 font-headline text-3xl font-extrabold tracking-tight text-primary">
            Grouped 7/12 Interpretation
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-on-surface-variant">
            Structured facts are grouped for reviewer reading. Raw payloads remain isolated in audit mode.
          </p>
        </div>
        <Badge tone="info">Evidence interpretation</Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {sections.map((section) => (
          <SectionCard
            key={section.id}
            id={section.id}
            rows={section.rows}
            detail={detail}
            signals={section.signals}
            onEvidenceSelect={onEvidenceSelect}
          />
        ))}
      </div>
    </section>
  );
}
