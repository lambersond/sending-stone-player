'use client'

import { useId } from 'react'
import { joinParts } from '../../utils/join-parts'
import { DescriptionLinks } from '../description-actions/description-links'
import { closingAfter, spellOrigin } from '../description-actions/utils'
import { SheetText } from '../sheet-text/sheet-text'
import { Facts } from './facts'
import {
  castAs,
  ownFacts,
  spellFacts,
  spellKind,
  textOf,
  whyNot,
} from './utils'
import { Modal } from '@/components/modal/modal'
import type { ActivityInfo } from './types'
import type {
  DescriptionActions,
  DescriptionOrigin,
} from '../description-actions/types'
import type { SheetSpell } from '@/types/sending-stone'

/*
 * All there is to know of an action: its facts, as it shows them once it's open; and, for one of an
 * item's activities folded beneath it, such as a staff's Starry Wisp, a dialog to read them in,
 * with the spell's school, components and description where it casts one, as the Spells tab shows
 * the spell under the item.
 */

/**
 * The dialog `useActionInfo` opens: what there is to read of one of an item's activities folded
 * beneath it, titled with its spell's name, where it casts one, or its own, and the item it's
 * from. Its description's links act as they do on the sheet, closing the dialog once one throws
 * dice or asks the table.
 */
export function ActionInfo({
  info,
  spell,
  characterId,
  actions,
  onClose,
}: Readonly<{
  info?: ActivityInfo
  spell?: SheetSpell
  characterId: string
  actions?: DescriptionActions
  onClose: () => void
}>) {
  return (
    <Modal
      open={!!info}
      onClose={onClose}
      title={spell?.name ?? info?.activity.name ?? ''}
      subtitle={
        info && joinParts(spell && spellKind(spell), `From ${info.item.name}`)
      }
    >
      {info && (
        <DescriptionLinks actions={actions && closingAfter(actions, onClose)}>
          <ActivityAbout characterId={characterId} info={info} spell={spell} />
        </DescriptionLinks>
      )}
    </Modal>
  )
}

/**
 * All there is to read of one of an item's activities: its marks, such as for concentration or no
 * charges left; its facts, a spell's among them where it casts one, with what a reaction answers
 * and how long it lasts; and the spell's description, or its own, or else the item's, under the
 * item's name.
 */
function ActivityAbout({
  characterId,
  info,
  spell,
}: Readonly<{
  characterId: string
  info: ActivityInfo
  spell?: SheetSpell
}>) {
  const headingId = useId()
  const { activity, action, item, foundry } = info
  const { cast } = activity
  const unusable =
    spell?.castFrom?.usable === false ? spell.castFrom : undefined
  const marks = [
    // Its own, or its spell's, never the item's: that's its first activity's, as the module has
    // it, and only a spell takes concentration.
    (cast?.concentration ?? spell?.concentration) && 'Concentration',
    cast?.short && 'No charges left',
    unusable && whyNot(unusable),
    foundry && 'Used in Foundry',
  ].filter(mark => typeof mark === 'string')
  const facts = [...ownFacts(activity, spell), ...spellFacts(spell, cast)]
  const formula = action.rollFormula
  if (formula) {
    facts.push({
      label: 'Formula',
      value: formula.name
        ? `${formula.formula} (${formula.name})`
        : formula.formula,
    })
  }
  const text = spell?.text ?? cast?.text ?? textOf(activity)
  // A spell's description is the spell's, cast from the item; an activity's own is the item's.
  const origin: DescriptionOrigin =
    spell || cast?.text
      ? {
          name: spellOrigin({
            name: spell?.name ?? activity.name,
            castFrom: item,
          }),
          item: item.id,
        }
      : { name: action.name, item: item.id }
  return (
    <div className='flex flex-col gap-3'>
      {marks.length > 0 && (
        <ul className='flex flex-wrap gap-1'>
          {marks.map(mark => (
            <li
              key={mark}
              className='rounded border border-border px-1.5 text-xs leading-5 font-semibold text-text-secondary'
            >
              {mark}
            </li>
          ))}
        </ul>
      )}
      <Facts
        action={spell ? castAs(action, spell) : action}
        casting={!!spell || activity.type === 'cast'}
        more={facts}
      />
      {text && (
        <SheetText characterId={characterId} hash={text} origin={origin} />
      )}
      {/* An activity that casts no spell known has no description of its own: its item's is
          what there is to read of it. */}
      {!text && item.text && (
        <section aria-labelledby={headingId} className='flex flex-col gap-1'>
          <h3
            id={headingId}
            className='text-xs font-semibold tracking-wider text-text-secondary uppercase'
          >
            {item.name}
          </h3>
          <SheetText
            characterId={characterId}
            hash={item.text}
            origin={{ name: item.name, item: item.id }}
          />
        </section>
      )}
    </div>
  )
}
