'use client'

import { LinkPill } from './link-pill'
import { formulaTerms } from '@/utils/formulas'
import type {
  DescriptionActions,
  DescriptionOrigin,
} from '../description-actions/types'
import type { RollLink } from '@/types/sending-stone'

/**
 * A description's own roll, such as a d4 of luck, which a tap rolls with the player's dice, named
 * for where it's from. One whose formula the app can't read is only its text.
 */
export function FormulaButton({
  link,
  label,
  hash,
  origin,
  actions,
}: Readonly<{
  link: RollLink
  label: string
  hash: string
  origin: DescriptionOrigin
  actions: DescriptionActions
}>) {
  const terms = formulaTerms(link.formula)
  if (!terms) return label
  return (
    <LinkPill
      label={`${label}, roll it`}
      tint='bg-primary/12 hover:bg-primary/20'
      onClick={() =>
        actions.rollFormula({
          label: `${origin.name} roll`,
          terms,
          source: { kind: 'textRoll', text: hash, link: link.n },
        })
      }
    >
      {label}
    </LinkPill>
  )
}
