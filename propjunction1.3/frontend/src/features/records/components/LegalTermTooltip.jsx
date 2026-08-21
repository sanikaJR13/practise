export function LegalTermTooltip({ term, definition, meaning, significance, practical }) {
  const resolvedMeaning = meaning ?? definition
  const resolvedAria = [term, resolvedMeaning, significance, practical].filter(Boolean).join('. ')

  return (
    <div className="group relative">
      <button
        type="button"
        className="w-full rounded-[1.1rem] border border-outline-variant/15 bg-surface-container-lowest px-4 py-4 text-left transition-colors hover:border-primary/20 focus:border-primary/20 focus:outline-none"
        aria-label={resolvedAria}
      >
        <p className="text-sm font-semibold text-primary">{term}</p>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{resolvedMeaning}</p>
      </button>
      <div className="pointer-events-none absolute left-0 top-[calc(100%+10px)] z-20 hidden w-80 rounded-[1rem] bg-primary px-4 py-4 text-xs leading-6 text-on-primary shadow-[0_18px_40px_rgba(25,30,44,0.18)] group-hover:block group-focus-within:block">
        <p className="font-semibold">{resolvedMeaning}</p>
        {significance ? <p className="mt-2">{significance}</p> : null}
        {practical ? <p className="mt-2 opacity-90">{practical}</p> : null}
      </div>
    </div>
  )
}
