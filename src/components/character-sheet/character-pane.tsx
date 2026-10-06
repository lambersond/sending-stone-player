'use client'

import { useRef, useState } from 'react'
import { DiceRendererProvider } from '@lambersond/3d-dice-react'
import clsx from 'clsx'
import {
  Backpack,
  BookOpen,
  ChessKnight,
  Feather,
  ListChecks,
  UserRound,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { ActionsTab } from './actions-tab'
import { BiographyTab } from './biography-tab'
import { CharacterSheet, classLine } from './character-sheet'
import { EffectsTab } from './effects-tab'
import { FeaturesTab } from './features-tab'
import { InventoryTab } from './inventory-tab'
import { RollTray } from './roll-tray'
import { SpellsTab } from './spells-tab'
import { Scroller } from '@/components/scroller'
import { useSheetRoller } from '@/hooks/use-sheet-roller'
import type { TableSheet } from '@/types/table'

type Props = { characterId: string; name: string; sheet: TableSheet }

/**
 * The parts of the sheet, in the order Tidy 5e's character sheet has them, with dnd5e's icons for
 * them where it has them, and Tidy's for Actions. Spells is only for a character who casts them.
 */
const TABS: { id: SheetTab; label: string; icon: LucideIcon }[] = [
  { id: 'character', label: 'Character', icon: UserRound },
  { id: 'actions', label: 'Actions', icon: ChessKnight },
  { id: 'inventory', label: 'Inventory', icon: Backpack },
  { id: 'spells', label: 'Spells', icon: BookOpen },
  { id: 'features', label: 'Features', icon: ListChecks },
  { id: 'effects', label: 'Effects', icon: WandSparkles },
  { id: 'biography', label: 'Biography', icon: Feather },
]
type SheetTab =
  | 'character'
  | 'actions'
  | 'inventory'
  | 'spells'
  | 'features'
  | 'effects'
  | 'biography'

/**
 * The character's sheet, rolling 3D dice across the screen. The dice and their textures load
 * once the sheet is shown, and leave with it.
 */
export function CharacterPane(props: Readonly<Props>) {
  return (
    <DiceRendererProvider>
      <RollingSheet {...props} />
    </DiceRendererProvider>
  )
}

function RollingSheet({ characterId, name, sheet }: Readonly<Props>) {
  const { roll, rollDamage, rolls, rolling } = useSheetRoller()
  const [chosen, setTab] = useState<SheetTab>('character')
  const scroller = useRef<HTMLDivElement>(null)
  const show = (next: SheetTab) => {
    setTab(next)
    scroller.current?.scrollTo?.({ top: 0 })
  }
  const casts =
    sheet.spellcasting !== null ||
    sheet.spells.some(section => section.spells.length > 0)
  const tabs = TABS.filter(({ id }) => id !== 'spells' || casts)
  // A tab the sheet no longer has, such as Spells for a character who lost theirs, shows the
  // character.
  const tab = tabs.some(({ id }) => id === chosen) ? chosen : 'character'

  return (
    <>
      {/* A container, so the tabs show only their icons, but for the chosen one, where all their
          labels don't fit. */}
      <div className='@container flex h-11 shrink-0 items-center gap-3 border-b border-border px-3 md:px-6 lg:px-7'>
        <div
          role='tablist'
          aria-label='Character sheet'
          className='flex min-w-0 gap-0.5 overflow-x-auto lg:shrink-0 @3xl:gap-1'
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`sheet-tab-${id}`}
              type='button'
              role='tab'
              title={label}
              aria-selected={tab === id}
              aria-controls='sheet-panel'
              onClick={() => show(id)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition-colors',
                // Seven tabs' icons, and the chosen one's label, fit a 320-pixel screen.
                tab === id ? 'px-2' : 'px-1.5 @3xl:px-2',
                tab === id
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-primary/5 hover:text-text-primary',
              )}
            >
              <Icon aria-hidden className='size-4' />
              <span className={clsx(tab !== id && 'sr-only @3xl:not-sr-only')}>
                {label}
              </span>
              {id === 'effects' && sheet.conditions.length > 0 && (
                <span className='size-1.5 rounded-full bg-ruby'>
                  <span className='sr-only'>
                    , {sheet.conditions.length} conditions
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
        <span className='ml-auto hidden min-w-0 truncate text-sm text-text-secondary lg:block'>
          {classLine(sheet)}
        </span>
      </div>
      <Scroller ref={scroller}>
        <div
          id='sheet-panel'
          role='tabpanel'
          aria-labelledby={`sheet-tab-${tab}`}
        >
          {tab === 'character' && (
            <CharacterSheet
              name={name}
              sheet={sheet}
              onRoll={request => {
                void roll(request)
              }}
              onShowConditions={() => show('effects')}
            />
          )}
          {tab === 'actions' && (
            <ActionsTab
              characterId={characterId}
              sheet={sheet}
              onRoll={request => {
                void roll(request)
              }}
              onRollDamage={request => {
                void rollDamage(request)
              }}
            />
          )}
          {tab === 'inventory' && (
            <InventoryTab characterId={characterId} sheet={sheet} />
          )}
          {tab === 'spells' && (
            <SpellsTab characterId={characterId} sheet={sheet} />
          )}
          {tab === 'features' && (
            <FeaturesTab characterId={characterId} sheet={sheet} />
          )}
          {tab === 'effects' && (
            <EffectsTab characterId={characterId} sheet={sheet} />
          )}
          {tab === 'biography' && (
            <BiographyTab characterId={characterId} sheet={sheet} />
          )}
        </div>
      </Scroller>
      {/* Rolls are made from the Character and Actions tabs, so the tray shows there; the rolls
          stay. */}
      {(tab === 'character' || tab === 'actions') && (
        <RollTray rolls={rolls} rolling={rolling} />
      )}
    </>
  )
}
