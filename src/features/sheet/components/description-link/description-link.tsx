'use client'

import { CheckButton } from './check-button'
import { ConditionButton } from './condition-button'
import { DamageButton } from './damage-button'
import { FormulaButton } from './formula-button'
import { SaveButton } from './save-button'
import type { LinkMenus } from './types'
import type {
  DescriptionActions,
  DescriptionOrigin,
} from '../description-actions/types'
import type { LinkPart } from '@/components/description/types'
import type { ReactNode } from 'react'

/*
 * The links in a description, as the sheet acts on them: a saving throw or check it calls for
 * opens a menu, to ask the table for it or roll the player's own; its damage or healing, and its
 * own rolls, roll at a tap with the player's dice, and its damage offers other ways to roll it, as
 * an action's does; and a condition it names shows its rules, on a hover or focus, and opens the
 * conditions panel at it on a tap. Each says only what the description says, as text; one the app
 * can't act on, such as a formula it can't read, is only that text.
 */

/**
 * A link in a description, as the sheet acts on it: by what `actions` do, or with none, as only
 * its text.
 */
export function DescriptionLink({
  part,
  hash,
  origin,
  actions,
  menus,
}: Readonly<{
  part: LinkPart
  /** The hash of the description it's in. */
  hash: string
  origin: DescriptionOrigin
  actions?: DescriptionActions
  menus: LinkMenus
}>): ReactNode {
  const { link, label } = part
  if (!actions) {
    return link.kind === 'condition' ? (
      <span className='ref'>{label}</span>
    ) : (
      label
    )
  }
  switch (link.kind) {
    case 'save': {
      return (
        <SaveButton
          link={link}
          label={label}
          secret={part.secret}
          hash={hash}
          actions={actions}
          menus={menus}
        />
      )
    }
    case 'check': {
      return (
        <CheckButton
          link={link}
          label={label}
          secret={part.secret}
          hash={hash}
          actions={actions}
          menus={menus}
        />
      )
    }
    case 'damage': {
      return (
        <DamageButton
          link={link}
          label={label}
          hash={hash}
          origin={origin}
          actions={actions}
          menus={menus}
        />
      )
    }
    case 'roll': {
      return (
        <FormulaButton
          link={link}
          label={label}
          hash={hash}
          origin={origin}
          actions={actions}
        />
      )
    }
    case 'condition': {
      return <ConditionButton link={link} label={label} actions={actions} />
    }
  }
}
