'use client'

import { Dices } from 'lucide-react'
import { LinkPill } from './link-pill'
import { askItems, modeWord, rollAgainst, saveTitle } from './utils'
import { D20_CHOICES } from '@/features/rolling/constants'
import { choiceItem } from '@/features/rolling/utils/menu-points'
import { formatModifier } from '@/utils/format-modifier'
import type { LinkMenus } from './types'
import type { DescriptionActions } from '../description-actions/types'
import type { MenuItem, RollTarget } from '@/features/rolling/types'
import type { SaveLink, SheetAbility } from '@/types/sending-stone'

/**
 * A saving throw a description calls for, which opens a menu: to ask the table for it, on the
 * game's own card, for the Gamemaster to roll for those it names, unless it's in a secret, which
 * the table mustn't read, and where this device doesn't send rolls, to send them; or to roll the
 * player's own, against its DC: for each of its abilities, and for one, with advantage, with
 * disadvantage, or modified first.
 */
export function SaveButton({
  link,
  label,
  secret,
  hash,
  actions,
  menus,
}: Readonly<{
  link: SaveLink
  label: string
  secret: boolean
  hash: string
  actions: DescriptionActions
  menus: LinkMenus
}>) {
  const title = saveTitle(link)
  const abilities = link.abilities.flatMap(id => {
    const ability = actions.abilities.find(each => each.id === id)
    return ability ? [ability] : []
  })
  const targetOf = (ability: SheetAbility): RollTarget => ({
    label: link.concentration
      ? 'Concentration check'
      : `${ability.label} saving throw`,
    modifier: ability.save,
    mode: ability.saveMode,
    source: { kind: 'save', key: ability.id, text: hash, link: link.n },
    // A concentration check, which dnd5e adds concentration's bonuses to, and so the dice
    // effects add to one, from module 0.42.0.
    ...(link.concentration && { ask: { type: 'concentration' as const } }),
  })
  const roll = (target: RollTarget, chosen?: 'adv' | 'dis') =>
    rollAgainst(actions, target, link.dc, chosen)
  const items: MenuItem<string>[] = [
    ...askItems(secret, actions),
    ...abilities.map(ability => ({
      id: `roll:${ability.id}`,
      label: `Roll my ${link.concentration ? 'concentration check' : `${ability.label} save`} (${formatModifier(ability.save)}${modeWord(ability.saveMode)})`,
      icon: Dices,
      tint: 'text-primary',
    })),
    // For one ability, the other ways to roll it, as the sheet's menu offers them.
    ...(abilities.length === 1
      ? D20_CHOICES.map(choice => choiceItem(choice))
      : []),
  ]
  const choose = (id: string) => {
    const [only] = abilities
    if (id === 'ask') {
      actions.ask({ label: title, text: hash, link: link.n })
    } else if (id === 'send') {
      actions.sendRolls?.()
    } else if (id.startsWith('roll:')) {
      const ability = abilities.find(each => `roll:${each.id}` === id)
      if (ability) roll(targetOf(ability))
    } else if (only && (id === 'adv' || id === 'dis')) {
      roll(targetOf(only), id)
    } else if (only && id === 'modify') {
      menus.modify(targetOf(only), link.dc)
    }
  }
  return (
    <LinkPill
      popup
      tint='bg-primary/12 hover:bg-primary/20'
      onClick={event =>
        menus.open({
          anchor: event.currentTarget,
          title,
          items,
          onChoose: choose,
        })
      }
    >
      {label}
    </LinkPill>
  )
}
