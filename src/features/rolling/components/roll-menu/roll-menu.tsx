'use client'

import { ChoiceMenu } from './choice-menu'
import { D20_CHOICES } from '@/features/rolling/constants'
import { choiceItem } from '@/features/rolling/utils/menu-points'
import type { MenuPlace } from './types'
import type { RollChoice } from '@/features/rolling/types'

/**
 * Other ways to roll a check or save, where the player clicked or pressed for them: at the pointer,
 * like the browser's own context menu, or above a finger. Arrow keys move between them; Escape, or
 * a click or tap elsewhere, closes it.
 */
export function RollMenu({
  choices = D20_CHOICES,
  labels = {},
  onChoose,
  ...place
}: Readonly<
  MenuPlace & {
    /** The ways it can be rolled; those of a d20 roll unless said. */
    choices?: RollChoice[]
    /** What to call a choice instead, such as "Roll maximum healing". */
    labels?: Partial<Record<RollChoice, string>>
    onChoose: (choice: RollChoice) => void
  }
>) {
  return (
    <ChoiceMenu
      {...place}
      items={choices.map(choice => ({
        ...choiceItem(choice),
        ...(labels[choice] && { label: labels[choice] }),
      }))}
      onChoose={onChoose}
    />
  )
}
