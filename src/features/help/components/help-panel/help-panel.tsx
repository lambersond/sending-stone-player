'use client'

import { HelpGuide } from '../help-guide/help-guide'
import { InThisGame } from '../in-this-game/in-this-game'
import { SidePanel } from '@/components/side-panel/side-panel'
import { GM_NOTE, HELP_SUBTITLE, HELP_TITLE } from '@/features/help/constants'
import { helpBox, helpSections, named } from '@/features/help/utils'
import type { HelpPanelProps } from '@/features/help/types'

/**
 * Help (ROADMAP item 12), in the page's side panel, 448 px wide from `sm` (D2), its title taking
 * focus as it opens: the player's guide, the same words at the Gamemaster's seat, there "What your
 * player sees", after the seat's note (H3 B); the "In this game" box at the top while the character
 * plays (H2 B, D3); then the "Go to" chips and the eight sections, "Dice an item rolls later"
 * among them where the campaign's module asks for those dice (H6 B).
 */
export function HelpPanel({
  open,
  onClose,
  ...facts
}: Readonly<HelpPanelProps>) {
  const note = facts.gm ? named(GM_NOTE, facts.name) : undefined
  const box = helpBox(facts)
  const sections = helpSections(facts.view.laterDice === true)
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={HELP_TITLE}
      subtitle={HELP_SUBTITLE[facts.gm ? 'gm' : 'player']}
      focusTitle
    >
      <div className='flex flex-col gap-5'>
        {note && (
          <p className='rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm leading-normal'>
            {note}
          </p>
        )}
        {box && <InThisGame box={box} />}
        <HelpGuide sections={sections} />
      </div>
    </SidePanel>
  )
}
