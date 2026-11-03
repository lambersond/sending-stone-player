'use client'

import { type ReactNode } from 'react'
import { CircleAlert, Info } from 'lucide-react'
import { useConditionsPanel } from '../conditions/use-conditions-panel'
import { useShowConditions } from '../conditions/use-show-conditions'
import { SheetEntry } from '../sheet-entry/sheet-entry'
import { SheetHeading } from '../sheet-heading/sheet-heading'
import { WildShapeNote } from '../wild-shape/wild-shape-note'
import { EffectEntry } from './effect-entry'
import { conditionDetail } from './utils'
import { useSheetId } from '@/features/sheet/hooks/use-sheet-ids'
import type { TableSheet } from '@/types/table'

/**
 * The character's conditions, with their rules, and effects, grouped as dnd5e's Effects tab
 * groups them: temporary, passive, inactive and unavailable. Beside the conditions' heading, a
 * button opens the sheet's aside with every condition's rules; or, on its own, one of its own.
 */
export function EffectsTab({
  characterId,
  sheet,
  favorites,
}: Readonly<{
  characterId: string
  sheet: TableSheet
  /** Shown first, such as the character's favorites. */
  favorites?: ReactNode
}>) {
  const shared = useShowConditions()
  const own = useConditionsPanel(sheet.conditions)
  const showConditions = shared ?? own.show
  // Unique on the page, where a companion's pane is mounted beside its character's.
  const conditionsId = useSheetId('conditions-heading')
  const sectionId = useSheetId('effects-')
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {/* While transformed, as by Wild Shape (module 0.40.0): its copies, changed here after. */}
      <WildShapeNote tab='effects' />
      {favorites}
      <section aria-labelledby={conditionsId} className='flex flex-col gap-2'>
        <div className='flex items-center gap-1'>
          <SheetHeading id={conditionsId}>Conditions</SheetHeading>
          <button
            type='button'
            aria-haspopup='dialog'
            aria-label='Every condition and its rules'
            title='Every condition and its rules'
            onClick={() => showConditions()}
            className='-my-1 rounded-full p-1 text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary'
          >
            <Info aria-hidden className='size-4' />
          </button>
        </div>
        {sheet.conditions.length > 0 ? (
          <ul className='rounded-2xl border border-border bg-card p-1.5'>
            {sheet.conditions.map(condition => (
              <SheetEntry
                key={condition.id}
                characterId={characterId}
                name={condition.name}
                img={condition.img}
                fallback={CircleAlert}
                detail={conditionDetail(condition)}
                text={condition.text}
              />
            ))}
          </ul>
        ) : (
          <p className='text-sm text-text-secondary'>None.</p>
        )}
      </section>

      {sheet.effects.map(section => (
        <section
          key={section.id}
          aria-labelledby={`${sectionId}${section.id}`}
          className='flex flex-col gap-2'
        >
          <SheetHeading id={`${sectionId}${section.id}`}>
            {section.label}
          </SheetHeading>
          <ul className='rounded-2xl border border-border bg-card p-1.5'>
            {section.effects.map(effect => (
              <EffectEntry
                key={effect.id}
                characterId={characterId}
                effect={effect}
              />
            ))}
          </ul>
        </section>
      ))}

      {sheet.effects.length === 0 && (
        <p className='text-sm text-text-secondary'>No effects.</p>
      )}

      {!shared && own.panel}
    </div>
  )
}
