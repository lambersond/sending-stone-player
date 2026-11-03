import { EndConcentrationButton } from './concentration'
import type { SheetConcentrationEffect } from '@/types/sending-stone'

/** A concentration's lead in its effect's row: what's concentrated on, and End. */
export function ConcentrationLeadRow({
  effect,
}: Readonly<{ effect: SheetConcentrationEffect }>) {
  // Not a paragraph: the confirm's dialog, with its heading, is rendered beside its button.
  return (
    <div className='flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs'>
      <span className='min-w-0 flex-1 font-semibold'>
        Concentrating on {effect.name}
      </span>
      <EndConcentrationButton effect={effect} />
    </div>
  )
}
