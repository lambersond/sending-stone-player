'use client'

import { type ReactNode, type RefObject } from 'react'
import { ActionsTab } from '../actions-tab/actions-tab'
import { BiographyTab } from '../biography-tab/biography-tab'
import { CharacterSheet } from '../character-sheet/character-sheet'
import { EffectsTab } from '../effects-tab/effects-tab'
import { FeaturesTab } from '../features-tab/features-tab'
import { InventoryTab } from '../inventory-tab/inventory-tab'
import { SpellsTab } from '../spells-tab/spells-tab'
import { Scroller } from '@/components/scroller/scroller'
import type { PaneActions, SheetTab } from './types'
import type { ActionsLayout } from '../actions-layout/types'
import type { PartySheets } from '../party-sheets/types'
import type { NotesPlace } from '@/features/notes/types'
import type { TransferControls } from '@/features/transfers/types'
import type { CreatureFacts, TableCombat, TableSheet } from '@/types/table'

/**
 * The tab shown, beside the favorites' column where the sheet is wide enough for one (`column`),
 * the favorites at its top where not (`strip`), on the tabs they're shown with.
 * @param onShowConditions - A condition's chip: its rules, where the app has them; else Effects.
 */
export function SheetPanel({
  bodyRef,
  scrollerRef,
  column,
  strip,
  idPrefix,
  tab,
  characterId,
  name,
  sheet,
  combat,
  creature,
  follows,
  notes,
  parties,
  transfers,
  layout,
  actions,
  onShowConditions,
}: Readonly<{
  bodyRef: RefObject<HTMLDivElement | null>
  scrollerRef: RefObject<HTMLDivElement | null>
  column: ReactNode
  strip: ReactNode
  idPrefix: string
  tab: SheetTab
  characterId: string
  name: string
  sheet: TableSheet
  combat?: TableCombat
  creature?: CreatureFacts
  follows?: string
  notes?: NotesPlace
  parties?: PartySheets
  transfers: TransferControls
  layout: ActionsLayout['layout']
  actions: PaneActions
  onShowConditions: (id: string) => void
}>) {
  return (
    <div ref={bodyRef} className='flex min-h-0 flex-1'>
      {column}
      <Scroller ref={scrollerRef}>
        {/* It takes focus once an effect deleted from its last row has gone (module 0.39.0). */}
        <div
          id={`${idPrefix}sheet-panel`}
          role='tabpanel'
          aria-labelledby={`${idPrefix}sheet-tab-${tab}`}
          tabIndex={-1}
          className='outline-none'
        >
          {tab === 'character' && (
            <CharacterSheet
              name={name}
              sheet={sheet}
              combat={combat}
              onRoll={actions.onRoll}
              onRollFormula={actions.onRollFormula}
              onShowConditions={onShowConditions}
              creature={creature}
              follows={follows}
              idPrefix={idPrefix}
            />
          )}
          {tab === 'actions' && (
            <ActionsTab
              characterId={characterId}
              sheet={sheet}
              {...actions}
              favorites={strip}
              layout={layout}
            />
          )}
          {tab === 'inventory' && (
            <InventoryTab
              characterId={characterId}
              sheet={sheet}
              {...actions}
              favorites={strip}
              transfers={transfers}
              parties={parties}
            />
          )}
          {tab === 'spells' && (
            <SpellsTab
              characterId={characterId}
              sheet={sheet}
              {...actions}
              favorites={strip}
            />
          )}
          {tab === 'features' && (
            <FeaturesTab characterId={characterId} sheet={sheet} {...actions} />
          )}
          {tab === 'effects' && (
            <EffectsTab
              characterId={characterId}
              sheet={sheet}
              favorites={strip}
            />
          )}
          {tab === 'biography' && (
            <BiographyTab
              characterId={characterId}
              name={name}
              sheet={sheet}
              notes={notes}
            />
          )}
        </div>
      </Scroller>
    </div>
  )
}
