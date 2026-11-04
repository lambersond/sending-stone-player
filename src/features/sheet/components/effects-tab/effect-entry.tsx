'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { concentrationLead } from '../concentration/concentration-lead'
import { useConcentrating } from '../concentration/use-concentrating'
import { EffectButtons } from '../effect-controls/effect-buttons'
import { useEffectChoice } from '../effect-controls/use-effect-choice'
import { SheetEntry } from '../sheet-entry/sheet-entry'
import { effectDetail } from './utils'
import { ConfirmModal } from '@/components/modal/confirm-modal'
import type { FavoriteTarget } from '@/types/roll'
import type { SheetEffect } from '@/types/sending-stone'

/**
 * An effect: where it came from and the time it has left, muted while it's off, or unavailable
 * for now, as an unequipped item's effect is; opening to its description. One of the character's
 * concentrations opens to what's concentrated on too, and a button that ends it, while the game
 * takes that from here: inside the opened row, never on the row itself, which opens it. From
 * module 0.39.0, where the campaign lets its player change it, as its `ops` say, it opens to Turn
 * off or Turn on, and Delete…, which its menu offers too; Delete… asks first, in a dialog of the
 * row's own, outside what opens, so that the menu opens it from a closed row.
 */
export function EffectEntry({
  characterId,
  effect,
  suppressed = false,
  favorite,
}: Readonly<{
  characterId: string
  effect: SheetEffect
  /** Said of it where the section it's in doesn't say so, as among favorites. */
  suppressed?: boolean
  /** What its row's favorites entry names, from module 0.37.0: the effect, unless said. */
  favorite?: FavoriteTarget | null
}>) {
  const concentration = useConcentrating()
  // Among the favorites, a row of its own, apart from the Effects tab's.
  const { choice, character, open, setOpen, row } = useEffectChoice(
    effect,
    favorite === undefined ? 'effects' : 'favorites',
  )
  const [deleting, setDeleting] = useState(false)
  let state: string | undefined
  if (effect.disabled) state = 'Off'
  else if (suppressed) state = 'Unavailable'
  const askDelete = () => setDeleting(true)
  return (
    <SheetEntry
      characterId={characterId}
      name={effect.name}
      img={effect.img}
      fallback={Sparkles}
      favoriteKey={`effect:${effect.id}`}
      favorite={favorite}
      open={open}
      onOpenChange={setOpen}
      rowRef={row}
      effectChoice={choice}
      onDelete={askDelete}
      dialog={
        choice && (
          <ConfirmModal
            open={deleting}
            onClose={() => setDeleting(false)}
            title={`Delete ${effect.name}?`}
            confirmLabel='Delete'
            cancelLabel='Keep'
            danger
            onConfirm={async () => choice.choose('delete')}
          >
            <p>
              It’s removed from {character} in Foundry, and can’t be undone.
            </p>
          </ConfirmModal>
        )
      }
      detail={effectDetail(effect)}
      aside={
        state && (
          <span className='shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-text-secondary'>
            {state}
          </span>
        )
      }
      muted={state !== undefined}
      lead={
        concentrationLead(effect.id, concentration) ??
        (choice && (
          <EffectButtons
            name={effect.name}
            choice={choice}
            onDelete={askDelete}
          />
        ))
      }
      text={effect.text}
    />
  )
}
