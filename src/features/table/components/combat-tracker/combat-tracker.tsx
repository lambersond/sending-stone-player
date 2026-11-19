'use client'

import { Swords } from 'lucide-react'
import { EncounterTabs } from '../encounter-tabs/encounter-tabs'
import { CombatantRow } from './combatant-row'
import { TurnPanel } from './turn-panel'
import { useTurnSaid } from './use-turn-said'
import { otherTurnsLine, turnHeading } from './utils'
import { EmptyState } from '@/components/empty-state/empty-state'
import { noCombatLines } from '@/features/table/utils/combat'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'
import type { PanelEnding } from '@/features/table/types'
import type { TableCombat } from '@/types/table'

/**
 * The encounter as the character's player sees it, while it's under way: whose turn it is, above
 * the initiative order. From module 0.36.0, the character's companions are the player's own, and on
 * a companion's turn its panel says to roll for it on its tab, which it opens. And on the seat's
 * turn, the panel offers End Turn. With two or more under way at once (item 36), a tab for each
 * above it, and one shown at a time. Before then, or with none, there's no combat to show, and it
 * says what `noCombatLines` has it say of the seat's own: in the encounter chosen for its scene
 * before Begin Combat, while the character or a companion of it waits for its initiative, to roll
 * it from the sheet; in one begun that isn't its scene's chosen one, nothing beneath its heading.
 * @param combats - Every encounter under way the Combat tab shows (the view's `combats`).
 * @param shown - The one it shows.
 * @param own - The seat's own encounter (the view's `combat`), whose initiative it may wait for.
 * @param onChoose - Shows an encounter, by id.
 * @param onOpen - Shows a companion's tab, by its key.
 * @param keys - The companions whose tabs the page shows.
 */
export function CombatTracker({
  combats = [],
  shown,
  own,
  onChoose,
  onOpen,
  keys,
  ...ending
}: Readonly<
  {
    combats?: readonly TableCombat[]
    shown?: TableCombat
    own?: TableCombat
    onChoose?: (id: string) => void
    onOpen?: (key: string) => void
    keys?: ReadonlySet<string>
  } & PanelEnding
>) {
  const { noCombat, rollInitiative } = seatWords(useTableRole())
  // Whose turn it is, said as it changes from a region first in either view, so it stays as the
  // encounter comes under way and its first turn is heard too, as each turn after it is; cleared
  // once said, so that it isn't heard again beside the panel's heading. The seat's turns in the
  // other encounters have a region of their own, so that a change in one never says the other's
  // again; a switch of tab says neither (item 36).
  const scope = shown?.id
  const turn = useTurnSaid(shown?.underWay ? turnHeading(shown) : '', scope)
  const others = useTurnSaid(otherTurnsLine(combats, shown), scope)
  const said = (
    <>
      <p aria-live='polite' className='sr-only'>
        {turn}
      </p>
      <p aria-live='polite' className='sr-only'>
        {others}
      </p>
    </>
  )
  const lines = noCombatLines(own)
  if (!shown?.underWay) {
    return (
      <>
        {said}
        <EmptyState icon={Swords} title='No combat right now'>
          {lines !== 'none' && <p>{noCombat}</p>}
          {lines === 'roll' && (
            <p className='mt-2 font-medium text-text-primary'>
              {rollInitiative}
            </p>
          )}
        </EmptyState>
      </>
    )
  }
  const tabbed = combats.length > 1

  // The turn stays in view above the initiative order as it scrolls, at any width. Its strip has
  // the page's background, so rows pass out of sight behind it. Padding follows the pane's width,
  // which beside the sheet on a wide screen is narrow. The encounters' tabs scroll away above it,
  // and one panel holds the strip and the order both.
  return (
    <>
      {said}
      <div className='mx-auto flex w-full max-w-3xl flex-col'>
        {tabbed && (
          <div className='px-4 pt-4 @xl:px-8 @xl:pt-6'>
            <EncounterTabs
              combats={combats}
              shown={shown.id}
              onChoose={id => onChoose?.(id)}
            />
          </div>
        )}
        <div
          className='flex flex-col'
          {...(tabbed && {
            id: 'encounter-panel',
            role: 'tabpanel',
            'aria-labelledby': `encounter-tab-${shown.id}`,
          })}
        >
          <div className='sticky top-0 z-10 bg-page px-4 pt-4 pb-3 @xl:px-8 @xl:pt-6'>
            <TurnPanel combat={shown} onOpen={onOpen} keys={keys} {...ending} />
          </div>
          <section
            aria-labelledby='initiative-heading'
            className='flex min-w-0 flex-col gap-2 px-4 pb-4 @xl:px-8 @xl:pb-6'
          >
            <div className='flex items-baseline justify-between gap-2 px-0.5'>
              <h2
                id='initiative-heading'
                className='text-xs font-semibold tracking-wider text-text-secondary uppercase'
              >
                Initiative
              </h2>
              {shown.name && (
                <span className='truncate text-xs text-text-secondary'>
                  {shown.name}
                </span>
              )}
            </div>
            {shown.combatants.length > 0 ? (
              <ol className='flex flex-col gap-2'>
                {shown.combatants.map(combatant => (
                  <CombatantRow
                    key={combatant.id}
                    combatant={combatant}
                    current={combatant.id === shown.currentId}
                  />
                ))}
              </ol>
            ) : (
              <p className='rounded-2xl border border-dashed border-border p-6 text-center text-sm text-text-secondary'>
                No one has joined this encounter yet.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
