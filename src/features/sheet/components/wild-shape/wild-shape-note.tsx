'use client'

import { use } from 'react'
import clsx from 'clsx'
import { WildShapeContext } from './use-wild-shape-row'
import {
  actionsNoteWords,
  spellsNoteWords,
  inventoryNoteWords,
  effectsNoteWords,
} from '@/utils/wild-shape-words'

/**
 * A shaped sheet's note on a tab (round 0.40.0 §5.6), at the player's own pane: what's left of the
 * character's gear and spells, and why its effects aren't changed from here meanwhile. Where gear
 * goes, when it comes back and the Moon's spells are Wild Shape's rules, said of a Wild Shape
 * alone: another transformation, such as a Polymorph, has its own, and its form's sheet says it.
 */
export function WildShapeNote({
  tab,
}: Readonly<{ tab: 'actions' | 'spells' | 'inventory' | 'effects' }>) {
  const ws = use(WildShapeContext)
  const { form, name, sheet } = ws
  if (!form || !ws.pane || ws.role !== 'player' || !sheet) return
  const wild = form.kind === 'wildShape'
  let text: string
  switch (tab) {
    case 'actions': {
      if (!wild) return
      text = actionsNoteWords(form.name, name)
      break
    }
    case 'spells': {
      text = spellsNoteWords(
        form.name,
        name,
        sheet.spells,
        wild && ws.block?.circle === 'moon',
      )
      break
    }
    case 'inventory': {
      if (!wild) return
      text = inventoryNoteWords(name)
      break
    }
    case 'effects': {
      if (!ws.effects) return
      text = effectsNoteWords(form.name, name)
      break
    }
  }
  return (
    <p
      data-wild-note={tab}
      className={clsx(
        'text-sm text-text-secondary',
        tab === 'spells' &&
          'rounded-2xl border border-dashed border-border p-3.5',
      )}
    >
      {text}
    </p>
  )
}
