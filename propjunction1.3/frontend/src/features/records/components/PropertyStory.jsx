import { BookText } from 'lucide-react'
import { Card } from '@/components/ui/Card'

export function PropertyStory({ story }) {
  return (
    <Card className="border border-outline-variant/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,244,246,0.92))] p-6 shadow-[0_18px_40px_rgba(3,22,50,0.06)]">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-primary-fixed/70 p-3 text-primary">
          <BookText className="h-4 w-4" />
        </div>
        <div>
          <p className="section-eyebrow">Evidence Narrative</p>
          <h3 className="mt-1 font-document text-[1.85rem] font-semibold leading-none text-primary">Readable source-evidence storyline</h3>
        </div>
      </div>
      <p className="mt-5 text-sm leading-8 text-on-surface-variant">{story}</p>
    </Card>
  )
}
