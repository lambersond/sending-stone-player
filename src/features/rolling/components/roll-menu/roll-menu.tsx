'use client'

import { ChoiceMenu } from './choice-menu'
import { D20_CHOICES } from '@/features/rolling/constants'
import { choiceItem } from '@/features/rolling/utils/menu-points'
import type { MenuPlace } from './types'
import type { MenuExtra, RollChoice } from '@/features/rolling/types'

/**
 * Other ways to roll a check or save, where the player clicked or pressed for them: at the pointer,
 * like the browser's own context menu, or above a finger. Arrow keys move between them; Escape, or
 * a click or tap elsewhere, closes it. After them, whatever else its part of the sheet offers
 * there, which rolls nothing.
 */
export function RollMenu({
  choices = D20_CHOICES,
  labels = {},
  extras = [],
  onChoose,
  ...place
}: Readonly<
  MenuPlace & {
    /** The ways it can be rolled; those of a d20 roll unless said. */
    choices?: RollChoice[]
    /** What to call a choice instead, such as "Roll maximum healing". */
    labels?: Partial<Record<RollChoice, string>>
    /** What else it offers, after the ways to roll: each does its own, the menu closed first. */
    extras?: MenuExtra[]
    onChoose: (choice: RollChoice) => void
  }
>) {
  return (
    <ChoiceMenu<string>
      {...place}
      items={[
        ...choices.map(choice => ({
          ...choiceItem(choice),
          ...(labels[choice] && { label: labels[choice] }),
        })),
        ...extras,
      ]}
      onChoose={id => {
        const extra = extras.find(each => each.id === id)
        const choice = choices.find(each => each === id)
        if (extra) {
          place.onClose()
          extra.onChoose()
        } else if (choice) onChoose(choice)
      }}
    />
  )
}
