'use client'

import { LinkPill } from './link-pill'
import { askItems, checkMenuItems, checkOptionName } from './utils'
import { checkTitle, toolOrSkillName } from '@/utils/description-links'
import type { LinkMenus } from './types'
import type { DescriptionActions } from '../description-actions/types'
import type { CheckLink } from '@/types/sending-stone'

/**
 * A check a description calls for, which opens a menu, as a saving throw's does: to ask the table
 * for it, on the game's own card, for the Gamemaster to roll for those it names, unless it's in a
 * secret, and where this device doesn't send rolls, to send them; or to roll the player's own,
 * against its DC: each way it may be made that the character can, and for one, with advantage,
 * with disadvantage, or modified first.
 */
export function CheckButton({
  link,
  label,
  secret,
  hash,
  actions,
  menus,
}: Readonly<{
  link: CheckLink
  label: string
  secret: boolean
  hash: string
  actions: DescriptionActions
  menus: LinkMenus
}>) {
  const using =
    link.usingTool &&
    (actions.tools.find(tool => tool.id === link.usingTool)?.name ||
      toolOrSkillName('tool', link.usingTool))
  const title = checkTitle(
    link.checks.map(option => checkOptionName(option, actions)),
    {
      dc: link.dc,
      ...(using && { using }),
    },
  )
  return (
    <LinkPill
      popup
      tint='bg-primary/12 hover:bg-primary/20'
      onClick={event =>
        menus.open({
          anchor: event.currentTarget,
          ...checkMenuItems({
            checks: link.checks,
            dc: link.dc,
            title,
            ask: {
              items: askItems(secret, actions),
              choose: id => {
                if (id === 'ask') {
                  actions.ask({ label: title, text: hash, link: link.n })
                } else if (id === 'send') {
                  actions.sendRolls?.()
                }
              },
            },
            own: true,
            actions,
            menus,
            usingTool: link.usingTool,
            from: { text: hash, link: link.n },
          }),
        })
      }
    >
      {label}
    </LinkPill>
  )
}
