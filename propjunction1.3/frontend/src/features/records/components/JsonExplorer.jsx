import { useMemo, useState } from 'react'
import { Copy, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightJson(value) {
  const escaped = escapeHtml(value)

  return escaped.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          return `<span class="text-[#0b2d53] font-semibold">${match}</span>`
        }

        return `<span class="text-[#7f2a5c]">${match}</span>`
      }

      if (/true|false/.test(match)) {
        return `<span class="text-[#2d6a4f]">${match}</span>`
      }

      if (/null/.test(match)) {
        return `<span class="text-[#8a4a1f]">${match}</span>`
      }

      return `<span class="text-[#1d4ed8]">${match}</span>`
    }
  )
}

export function JsonExplorer({ tabs }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'summary')
  const [searchTerm, setSearchTerm] = useState('')
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  const jsonText = useMemo(() => JSON.stringify(active?.payload ?? {}, null, 2), [active])
  const filteredText = useMemo(() => {
    if (!searchTerm.trim()) {
      return jsonText
    }

    return jsonText
      .split('\n')
      .filter((line) => line.toLowerCase().includes(searchTerm.trim().toLowerCase()))
      .join('\n')
  }, [jsonText, searchTerm])

  return (
    <Card className="overflow-hidden border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(242,244,246,0.95))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="section-eyebrow">Raw Data Explorer</p>
          <h2 className="mt-2 font-document text-[2rem] font-semibold leading-none text-primary">Auditable payload and source values</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
            Legal teams and developers can inspect the normalized summary, canonical data, raw transaction rows, and the original metadata envelope without leaving the page.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] transition',
                activeTab === tab.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:text-primary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <label className="block w-full xl:max-w-sm">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Search within active JSON</span>
          <div className="field-shell mt-2 flex items-center gap-3 bg-white">
            <Search className="h-4 w-4 text-on-surface-variant" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search keys, values, survey references, owners"
              className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-on-surface-variant"
            />
          </div>
        </label>

        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(jsonText)
            } catch {
              // no-op fallback for environments without clipboard access
            }
          }}
        >
          <Copy className="h-4 w-4" />
          Copy active JSON
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.4rem] border border-outline-variant/15 bg-[#f6f8fc]">
        <div className="flex items-center justify-between gap-4 border-b border-outline-variant/10 px-4 py-3 text-xs text-on-surface-variant">
          <span>{active?.label}</span>
          <span>{filteredText ? filteredText.split('\n').length : 0} line(s)</span>
        </div>
        <div className="max-h-[34rem] overflow-auto px-4 py-4">
          <pre
            className="whitespace-pre-wrap break-words text-xs leading-6"
            dangerouslySetInnerHTML={{ __html: highlightJson(filteredText || '// No matching lines in the active JSON view') }}
          />
        </div>
      </div>
    </Card>
  )
}
