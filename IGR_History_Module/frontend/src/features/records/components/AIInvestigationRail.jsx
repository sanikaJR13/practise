import { useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  ChevronDown,
  CircleHelp,
  FileWarning,
  Gauge,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  Tags
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

const DEFAULT_PROMPTS = [
  'Explain this Itar Hakk entry',
  'Why is confidence capped?',
  'Show evidence for this signal',
  'Why reviewer verification required?'
];

function toPercent(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
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

function display(value, fallback = 'Not surfaced') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value.length ? value.map((item) => humanize(item)).join(', ') : fallback;
  }

  if (typeof value === 'object') {
    return fallback;
  }

  return humanize(value);
}

function severityTone(value) {
  const normalized = String(value ?? '').toLowerCase();
  if (['critical', 'high'].includes(normalized)) return 'warning';
  if (['medium', 'moderate'].includes(normalized)) return 'info';
  return 'neutral';
}

function RailSection({ id, title, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-[1.25rem] border border-outline-variant/16 bg-surface-container-lowest">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={`${id}-section`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="rounded-[0.85rem] bg-primary-fixed/35 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold text-primary">{title}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-on-surface-variant transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id={`${id}-section`} className="border-t border-outline-variant/12 px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function CompactList({ items, emptyLabel, onSelect, getPayload }) {
  const visibleItems = items.filter(Boolean);

  if (!visibleItems.length) {
    return <p className="text-sm leading-6 text-on-surface-variant">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {visibleItems.map((item, index) => (
        <button
          key={item.id ?? item.code ?? item.label ?? index}
          type="button"
          className="w-full rounded-[1rem] border border-outline-variant/14 bg-surface-container-low px-3 py-3 text-left transition hover:border-primary/25 hover:bg-white"
          onClick={() => onSelect?.(getPayload ? getPayload(item, index) : item)}
        >
          <p className="text-sm font-semibold text-primary">{display(item.label ?? item.title ?? item.summary ?? item)}</p>
          {item.summary || item.detail || item.reason || item.guidance ? (
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-on-surface-variant">
              {display(item.summary ?? item.detail ?? item.reason ?? item.guidance)}
            </p>
          ) : null}
          {item.severity || item.priority || item.status ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.severity ? <Badge tone={severityTone(item.severity)}>{display(item.severity)}</Badge> : null}
              {item.priority ? <Badge tone={severityTone(item.priority)}>{display(item.priority)}</Badge> : null}
              {item.status ? <Badge tone="neutral">{display(item.status)}</Badge> : null}
            </div>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function buildEvidencePayload(source, fallbackSection) {
  return {
    id: source.id ?? source.code ?? source.label,
    sourceType: source.sourceType ?? 'investigation',
    sourceName: source.sourceName ?? 'AI investigation rail',
    sourceSection: source.sourceSection ?? fallbackSection,
    sourceField: source.sourceField ?? source.code ?? source.category,
    rawValue: source.rawValue ?? source.summary ?? source.detail ?? source.reason ?? source.guidance ?? source.label,
    normalizedValue: source.normalizedValue ?? source.label ?? source.title,
    semanticMeaning: source.semanticMeaning ?? source.summary ?? source.reason ?? source.guidance,
    citation: source.citation ?? source.evidenceRefs?.[0]?.citation ?? source.evidenceRefs?.[0]?.label,
    confidence: source.confidence ?? null,
    status: source.status ?? 'interpreted',
    provenance: source.provenance ?? null
  };
}

function displayGovernanceLabel(label) {
  if (label === 'not_title_proof') {
    return 'not legal decision';
  }

  return String(label).replace(/_/g, ' ');
}

export function AIInvestigationRail({
  sevenTwelveDetail,
  riskReport,
  aiInvestigation,
  onEvidenceSelect
}) {
  const confidence = riskReport?.confidence ?? sevenTwelveDetail?.confidence ?? {};
  const confidenceScore = toPercent(confidence.score);
  const severityLabel = display(riskReport?.level ?? riskReport?.displayLabel, 'Review required');
  const findings = [
    ...(riskReport?.keyFindings ?? []),
    ...(aiInvestigation?.findings ?? []),
    ...(sevenTwelveDetail?.riskSignals ?? [])
  ].slice(0, 6);
  const missingEvidence = [
    ...(riskReport?.missingEvidence ?? []),
    ...(aiInvestigation?.missingEvidence ?? []),
    ...(sevenTwelveDetail?.missingEvidence ?? [])
  ].slice(0, 6);
  const reviewerActions = [
    ...(sevenTwelveDetail?.reviewerActions ?? []),
    ...(riskReport?.reviewerActions ?? []),
    ...(aiInvestigation?.reviewerGuidance ?? [])
  ].slice(0, 6);
  const semanticSignals = [
    ...(sevenTwelveDetail?.semanticSignals ?? []),
    ...(riskReport?.semanticSignals ?? []),
    ...(aiInvestigation?.semanticExplanations ?? [])
  ].slice(0, 8);
  const governanceLabels = [
    ...(aiInvestigation?.governanceLabels ?? []),
    'extracted_evidence',
    'semantic_interpretation',
    'reviewer_verification_required'
  ];

  return (
    <Card className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-auto border border-outline-variant/16 bg-surface-container-low p-4 shadow-[0_24px_60px_rgba(3,22,50,0.08)]">
      <div className="rounded-[1.35rem] border border-outline-variant/14 bg-surface-container-lowest p-4">
        <p className="section-eyebrow">AI Investigation Rail</p>
        <h2 className="mt-2 font-headline text-xl font-extrabold text-primary">Contextual review</h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          AI-assisted evidence interpretation for the current 7/12 packet. Reviewer verification required.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <RailSection id="severity" title="Investigation Severity" icon={Gauge}>
          <div className="rounded-[1rem] bg-primary text-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Severity</p>
            <p className="mt-2 font-headline text-2xl font-extrabold">{severityLabel}</p>
            <p className="mt-2 text-sm leading-6 text-white/72">
              {riskReport?.executiveSummary ?? 'Severity is based on available evidence density and missing record signals.'}
            </p>
          </div>
        </RailSection>

        <RailSection id="findings" title="Key Findings" icon={AlertTriangle}>
          <CompactList
            items={findings}
            emptyLabel="No key findings surfaced from current evidence."
            onSelect={onEvidenceSelect}
            getPayload={(item) => buildEvidencePayload(item, 'keyFinding')}
          />
        </RailSection>

        <RailSection id="confidence" title="Confidence Explanation" icon={BrainCircuit}>
          <div className="space-y-3">
            <div className="rounded-[1rem] border border-outline-variant/14 bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-primary">Operational confidence</span>
                <span className="text-sm font-bold text-primary">
                  {confidenceScore === null ? 'Not surfaced' : `${confidenceScore}%`}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-container">
                <div className="h-full rounded-full bg-primary" style={{ width: `${confidenceScore ?? 0}%` }} />
              </div>
            </div>
            <CompactList
              items={[...(confidence.caps ?? []), ...(confidence.blockers ?? []), ...(confidence.reasons ?? [])].map((item, index) => ({
                id: `confidence-${index + 1}`,
                label: item
              }))}
              emptyLabel={aiInvestigation?.confidenceExplanation ?? 'No confidence blockers surfaced.'}
              onSelect={onEvidenceSelect}
              getPayload={(item) => buildEvidencePayload(item, 'confidence')}
            />
          </div>
        </RailSection>

        <RailSection id="missing" title="Missing Evidence" icon={FileWarning}>
          <CompactList
            items={missingEvidence.map((item, index) => ({ id: `missing-${index + 1}`, label: item }))}
            emptyLabel="No missing evidence surfaced from current evidence."
            onSelect={onEvidenceSelect}
            getPayload={(item) => buildEvidencePayload(item, 'missingEvidence')}
          />
        </RailSection>

        <RailSection id="actions" title="Reviewer Actions" icon={ListChecks}>
          <CompactList
            items={reviewerActions}
            emptyLabel="No reviewer actions surfaced."
            onSelect={onEvidenceSelect}
            getPayload={(item) => buildEvidencePayload(item, 'reviewerAction')}
          />
        </RailSection>

        <RailSection id="semantic" title="Semantic Signals" icon={Tags} defaultOpen={false}>
          <CompactList
            items={semanticSignals}
            emptyLabel="No semantic signals surfaced."
            onSelect={onEvidenceSelect}
            getPayload={(item) => buildEvidencePayload(item, 'semanticSignal')}
          />
        </RailSection>

        <RailSection id="ask" title="Ask About This Property" icon={MessageSquareText} defaultOpen={false}>
          <div className="space-y-2">
            {DEFAULT_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="flex w-full items-center gap-2 rounded-[1rem] border border-outline-variant/14 bg-surface-container-low px-3 py-3 text-left text-sm font-semibold text-primary transition hover:border-primary/25 hover:bg-white"
                onClick={() =>
                  onEvidenceSelect?.({
                    id: `prompt-${prompt}`,
                    sourceSection: 'askAi',
                    sourceField: 'contextualQuestion',
                    rawValue: prompt,
                    normalizedValue: prompt,
                    semanticMeaning: 'Contextual AI question prepared for this property evidence packet.',
                    citation: 'Current 7/12 investigation workspace',
                    status: 'ai_suggested'
                  })
                }
              >
                <CircleHelp className="h-4 w-4 text-on-surface-variant" />
                {prompt}
              </button>
            ))}
          </div>
        </RailSection>

        <RailSection id="governance" title="Governance Labels" icon={ShieldCheck} defaultOpen={false}>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(governanceLabels)).map((label) => (
              <Badge key={label} tone="info">
                {displayGovernanceLabel(label)}
              </Badge>
            ))}
          </div>
        </RailSection>
      </div>
    </Card>
  );
}
