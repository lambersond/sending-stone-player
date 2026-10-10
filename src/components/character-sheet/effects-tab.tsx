'use client'

import { CircleAlert, Info, Sparkles } from 'lucide-react'
import { useConditionsPanel, useShowConditions } from './conditions-panel'
import { SheetEntry } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import type { SheetCondition, SheetEffect } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { ReactNode } from 'react'

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
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {favorites}
      <section
        aria-labelledby='conditions-heading'
        className='flex flex-col gap-2'
      >
        <div className='flex items-center gap-1'>
          <SheetHeading id='conditions-heading'>Conditions</SheetHeading>
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
          aria-labelledby={`effects-${section.id}`}
          className='flex flex-col gap-2'
        >
          <SheetHeading id={`effects-${section.id}`}>
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

/**
 * An effect: where it came from and the time it has left, muted while it's off, or unavailable
 * for now, as an unequipped item's effect is; opening to its description.
 */
export function EffectEntry({
  characterId,
  effect,
  suppressed = false,
}: Readonly<{
  characterId: string
  effect: SheetEffect
  /** Said of it where the section it's in doesn't say so, as among favorites. */
  suppressed?: boolean
}>) {
  let state: string | undefined
  if (effect.disabled) state = 'Off'
  else if (suppressed) state = 'Unavailable'
  return (
    <SheetEntry
      characterId={characterId}
      name={effect.name}
      img={effect.img}
      fallback={Sparkles}
      favoriteKey={`effect:${effect.id}`}
      detail={effectDetail(effect)}
      aside={
        state && (
          <span className='shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-text-secondary'>
            {state}
          </span>
        )
      }
      muted={state !== undefined}
      text={effect.text}
    />
  )
}

/**
 * Where an effect came from, unless that is its own name, as for a spell's effect named after the
 * spell, and the time it has left.
 */
function effectDetail(effect: SheetEffect): string | undefined {
  const source =
    effect.source && effect.source !== effect.name
      ? `From ${effect.source}`
      : undefined
  return [source, effect.duration].filter(Boolean).join(' · ') || undefined
}

/** What qualifies a condition: Exhaustion's level, or what the character is concentrating on. */
export function conditionDetail(condition: SheetCondition): string | undefined {
  if (condition.level !== null) return `Level ${condition.level}`
  return condition.detail ?? undefined
}
