'use client'

import { useRef, useState } from 'react'
import { DiceRendererProvider } from '@lambersond/3d-dice-react'
import clsx from 'clsx'
import {
  ListChecks,
  UserRound,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { CharacterSheet, classLine } from './character-sheet'
import { EffectsTab } from './effects-tab'
import { FeaturesTab } from './features-tab'
import { RollTray } from './roll-tray'
import { Scroller } from '@/components/scroller'
import { useSheetRoller } from '@/hooks/use-sheet-roller'
import type { TableSheet } from '@/types/table'

type Props = { characterId: string; name: string; sheet: TableSheet }

/** The parts of the sheet, in the order Tidy 5e's character sheet has them. */
const TABS: { id: SheetTab; label: string; icon: LucideIcon }[] = [
  { id: 'character', label: 'Character', icon: UserRound },
  { id: 'features', label: 'Features', icon: ListChecks },
  { id: 'effects', label: 'Effects', icon: WandSparkles },
]
type SheetTab = 'character' | 'features' | 'effects'

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
  const { roll, rolls, rolling } = useSheetRoller()
  const [tab, setTab] = useState<SheetTab>('character')
  const scroller = useRef<HTMLDivElement>(null)
  const show = (next: SheetTab) => {
    setTab(next)
    scroller.current?.scrollTo?.({ top: 0 })
  }

  return (
    <>
      <div className='flex h-11 shrink-0 items-center gap-3 border-b border-border px-3 md:px-6 lg:px-7'>
        <div
          role='tablist'
          aria-label='Character sheet'
          className='flex min-w-0 gap-1 overflow-x-auto'
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`sheet-tab-${id}`}
              type='button'
              role='tab'
              aria-selected={tab === id}
              aria-controls='sheet-panel'
              onClick={() => show(id)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors',
                tab === id
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-primary/5 hover:text-text-primary',
              )}
            >
              <Icon aria-hidden className='size-4' />
              {label}
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
        <span className='ml-auto hidden truncate text-sm text-text-secondary lg:block'>
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
          {tab === 'features' && (
            <FeaturesTab characterId={characterId} sheet={sheet} />
          )}
          {tab === 'effects' && (
            <EffectsTab characterId={characterId} sheet={sheet} />
          )}
        </div>
      </Scroller>
      {/* Rolls are made from the Character tab, so the tray shows there; the rolls stay. */}
      {tab === 'character' && <RollTray rolls={rolls} rolling={rolling} />}
    </>
  )
}
