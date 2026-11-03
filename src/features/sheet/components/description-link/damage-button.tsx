'use client'

import clsx from 'clsx'
import { HeartPulse, Swords } from 'lucide-react'
import { PILL } from './constants'
import { LinkPill } from './link-pill'
import { damageRequest, damageWays, thrownBy, typeLabel } from './utils'
import { RollButton } from '@/features/rolling/components/roll-button/roll-button'
import { EVERY_DIE_TWICE, criticalOffered } from '@/utils/damage-modifiers'
import { formulaTerms } from '@/utils/formulas'
import type { LinkMenus } from './types'
import type {
  DescriptionActions,
  DescriptionOrigin,
} from '../description-actions/types'
import type { DamageChoice, MenuPoint } from '@/features/rolling/types'
import type { DamageLink } from '@/types/sending-stone'

/**
 * Damage or healing a description deals, which a tap rolls with the player's dice, named for where
 * it's from; first asking which kind, where it offers a choice. A right-click, a long-press, or the
 * keyboard's context menu key offers other ways to roll it, as an action's damage does: as a
 * critical hit's, for damage; at its highest, unless it takes a die away; or with its dice changed
 * first, where it has a first die that it adds; then which kind, where it offers a choice, the menu
 * saying what will be thrown, and how. A critical hit's adds what one adds to it, as the game reads
 * its activity, such as a weapon's extra dice and critical damage. Where the Gamemaster's game
 * rolls it too, it offers only those the game takes: a critical hit's as the world's rules make
 * one, where the sheet says how and they take what it adds, and changed where the game takes it
 * so, as a module before 0.21.0, which changes its first die whatever its sign, does only where
 * that's one it adds; where the player alone rolls it, a critical hit's is as dnd5e makes one by
 * default. One whose formula the app can't read is only its text.
 */
export function DamageButton({
  link,
  label,
  hash,
  origin,
  actions,
  menus,
}: Readonly<{
  link: DamageLink
  label: string
  hash: string
  origin: DescriptionOrigin
  actions: DescriptionActions
  menus: LinkMenus
}>) {
  const terms = link.parts.map(part => formulaTerms(part.formula))
  const read = terms.flatMap(each => (each ? [each] : []))
  if (read.length !== link.parts.length) return label
  const kind = link.healing ? 'healing' : 'damage'
  const name = `${origin.name} ${kind}`
  const formula = link.parts.map(part => part.formula).join(' + ')
  const choice = link.parts.find(part => part.types.length > 1)
  const table = actions.damage
  const rule = table?.critical
  // What a critical hit adds, where one is offered: as the world's rules make one, where the game
  // rolls it too, or else as dnd5e does by default.
  const adds = criticalOffered(link, table ? rule : EVERY_DIE_TWICE)
  const ways = damageWays(read, table, adds)
  const roll = (chosen: string | undefined, way: DamageChoice = {}) => {
    actions.rollDamage(
      damageRequest(link, { name, hash, read, rule, adds }, chosen, way),
    )
  }
  // Which kind first, where it offers a choice, then rolled so, the way chosen: the menu says what
  // will be thrown, as the damage menu says it, and how.
  const rollFrom = (
    anchor: HTMLElement,
    way?: DamageChoice,
    point?: MenuPoint,
  ) => {
    if (!choice) {
      roll(undefined, way)
      return
    }
    const critical = way?.critical === true
    const maximum = way?.modifiers?.maximize === true
    const thrown = way ? thrownBy(read, way, rule, adds || undefined) : formula
    const how = [critical && 'Critical hit', maximum && 'Maximum']
      .filter(Boolean)
      .map(word => ` · ${word}`)
      .join('')
    let adjective = ''
    if (critical) adjective = 'critical '
    else if (maximum) adjective = 'maximum '
    menus.open({
      anchor,
      point,
      title: `${name} ${thrown}${how}`,
      items: choice.types.map(type => ({
        id: type,
        label: link.healing
          ? `Roll ${adjective}${typeLabel(type)}`
          : `Roll ${adjective}${typeLabel(type)} damage`,
        icon: link.healing ? HeartPulse : Swords,
        tint: link.healing ? 'text-primary' : 'text-damage',
      })),
      onChoose: type => roll(type, way),
    })
  }
  const tint = link.healing
    ? 'bg-primary/12 text-primary-text hover:bg-primary/20'
    : 'bg-damage/15 text-damage hover:bg-damage/25'
  const props = {
    label: `${label}, roll ${kind}`,
    className: clsx(PILL, tint),
  }
  if (ways.length === 0) {
    return (
      <LinkPill
        label={props.label}
        popup={!!choice}
        tint={tint}
        onClick={event => rollFrom(event.currentTarget)}
      >
        {label}
      </LinkPill>
    )
  }
  return (
    <RollButton
      target={link}
      onRoll={(_link, anchor) => rollFrom(anchor)}
      onMenu={(anchor, _link, point) =>
        menus.damage(
          anchor,
          {
            label: name,
            formula,
            // As thrown unchanged, each part as the kind it is, where it offers no choice.
            parts: read.map((part, index) => {
              const { types } = link.parts[index]
              return {
                terms: part,
                type: types.length === 1 ? typeLabel(types[0]) : null,
              }
            }),
            healing: link.healing,
            choices: ways,
            ...(rule && { criticalRule: rule }),
            ...(adds && { criticalAdds: adds }),
            onChoose: way => rollFrom(anchor, way, point),
          },
          point,
        )
      }
      {...props}
    >
      {label}
    </RollButton>
  )
}
