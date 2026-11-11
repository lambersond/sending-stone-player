'use client'

import { Swords } from 'lucide-react'
import { CombatantRow } from './combatant-row'
import { TurnPanel } from './turn-panel'
import { turnHeading } from './utils'
import { EmptyState } from '@/components/empty-state/empty-state'
import { waitsForInitiative } from '@/features/table/utils/combat'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'
import type { PanelEnding } from '@/features/table/types'
import type { TableCombat } from '@/types/table'

/**
 * The encounter as the character's player sees it, while it's under way: whose turn it is, above
 * the initiative order. From module 0.36.0, the character's companions are the player's own, and on
 * a companion's turn its panel says to roll for it on its tab, which it opens. And on the seat's
 * turn, the panel offers End Turn. Before then, or with none, there's no combat to show; while the
 * character or a companion of it waits for its initiative in an encounter being set up, it says to
 * roll it from the sheet.
 * @param onOpen - Shows a companion's tab, by its key.
 * @param keys - The companions whose tabs the page shows.
 */
export function CombatTracker({
  combat,
  onOpen,
  keys,
  ...ending
}: Readonly<
  {
    combat?: TableCombat
    onOpen?: (key: string) => void
    keys?: ReadonlySet<string>
  } & PanelEnding
>) {
  const { noCombat, rollInitiative } = seatWords(useTableRole())
  // Whose turn it is, said as it changes from a region first in either view, so it stays as the
  // encounter comes under way and its first turn is heard too, as each turn after it is.
  const said = (
    <p aria-live='polite' className='sr-only'>
      {combat?.underWay ? turnHeading(combat) : ''}
    </p>
  )
  if (!combat?.underWay) {
    const waiting = combat !== undefined && waitsForInitiative(combat)
    return (
      <>
        {said}
        <EmptyState icon={Swords} title='No combat right now'>
          <p>{noCombat}</p>
          {waiting && (
            <p className='mt-2 font-medium text-text-primary'>
              {rollInitiative}
            </p>
          )}
        </EmptyState>
      </>
    )
  }

  // The turn stays in view above the initiative order as it scrolls, at any width. Its strip has
  // the page's background, so rows pass out of sight behind it. Padding follows the pane's width,
  // which beside the sheet on a wide screen is narrow.
  return (
    <>
      {said}
      <div className='mx-auto flex w-full max-w-3xl flex-col'>
        <div className='sticky top-0 z-10 bg-page px-4 pt-4 pb-3 @xl:px-8 @xl:pt-6'>
          <TurnPanel combat={combat} onOpen={onOpen} keys={keys} {...ending} />
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
            {combat.name && (
              <span className='truncate text-xs text-text-secondary'>
                {combat.name}
              </span>
            )}
          </div>
          {combat.combatants.length > 0 ? (
            <ol className='flex flex-col gap-2'>
              {combat.combatants.map(combatant => (
                <CombatantRow
                  key={combatant.id}
                  combatant={combatant}
                  current={combatant.id === combat.currentId}
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
    </>
  )
}
