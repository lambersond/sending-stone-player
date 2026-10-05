import { CircleAlert, Sparkles } from 'lucide-react'
import { SheetEntry } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import type { SheetCondition, SheetEffect } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/**
 * The character's conditions, with their rules, and effects, grouped as dnd5e's Effects tab
 * groups them: temporary, passive, inactive and unavailable.
 */
export function EffectsTab({
  characterId,
  sheet,
}: Readonly<{ characterId: string; sheet: TableSheet }>) {
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      <section
        aria-labelledby='conditions-heading'
        className='flex flex-col gap-2'
      >
        <SheetHeading id='conditions-heading'>Conditions</SheetHeading>
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
              <SheetEntry
                key={effect.id}
                characterId={characterId}
                name={effect.name}
                img={effect.img}
                fallback={Sparkles}
                detail={effectDetail(effect)}
                aside={
                  effect.disabled && (
                    <span className='shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-text-secondary'>
                      Off
                    </span>
                  )
                }
                muted={effect.disabled}
                text={effect.text}
              />
            ))}
          </ul>
        </section>
      ))}

      {sheet.effects.length === 0 && (
        <p className='text-sm text-text-secondary'>No effects.</p>
      )}
    </div>
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
