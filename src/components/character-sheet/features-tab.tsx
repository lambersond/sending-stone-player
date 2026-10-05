import clsx from 'clsx'
import { BookOpen, HeartPulse, Sparkles } from 'lucide-react'
import { SheetEntry } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import type { SheetClass, SheetUses } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/**
 * The character's classes, with their hit dice, and features, grouped as dnd5e's Features tab
 * groups them: by the class, species or background each came from. Each opens to its
 * description.
 */
export function FeaturesTab({
  characterId,
  sheet,
}: Readonly<{ characterId: string; sheet: TableSheet }>) {
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {sheet.classes.length > 0 && (
        <section
          aria-labelledby='classes-heading'
          className='flex flex-col gap-2'
        >
          <SheetHeading id='classes-heading'>Classes</SheetHeading>
          <ul className='grid gap-2 @xl:grid-cols-2'>
            {sheet.classes.map(entry => (
              <ClassCard key={entry.id ?? entry.name} entry={entry} />
            ))}
          </ul>
        </section>
      )}

      {sheet.features.map(section => (
        <section
          key={section.id}
          aria-labelledby={`features-${section.id}`}
          className='flex flex-col gap-2'
        >
          <SheetHeading id={`features-${section.id}`}>
            {section.label}
          </SheetHeading>
          <ul className='rounded-2xl border border-border bg-card p-1.5'>
            {section.text && (
              <SheetEntry
                characterId={characterId}
                name={`About ${originName(sheet, section.id) ?? 'this'}`}
                fallback={BookOpen}
                text={section.text}
              />
            )}
            {section.features.map(feature => (
              <SheetEntry
                key={feature.id}
                characterId={characterId}
                name={feature.name}
                img={feature.img}
                fallback={Sparkles}
                detail={join(
                  feature.activation ??
                    (feature.passive ? 'Passive' : undefined),
                  feature.uses?.recovery,
                )}
                aside={feature.uses && <UsesLeft uses={feature.uses} />}
                meta={join(feature.kind, feature.requirements)}
                text={feature.text}
              />
            ))}
          </ul>
        </section>
      ))}

      {sheet.features.length === 0 && (
        <p className='text-sm text-text-secondary'>No features to show yet.</p>
      )}
    </div>
  )
}

function ClassCard({ entry }: Readonly<{ entry: SheetClass }>) {
  const { hitDice } = entry
  return (
    <li className='flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3'>
      <span className='min-w-0'>
        <span className='block truncate font-semibold'>
          {entry.name}
          {entry.levels !== null && ` ${entry.levels}`}
        </span>
        {entry.subclass && (
          <span className='block truncate text-sm text-text-secondary'>
            {entry.subclass}
          </span>
        )}
      </span>
      {hitDice && (
        <span className='flex shrink-0 items-center gap-1.5 text-sm'>
          <HeartPulse aria-hidden className='size-4 text-text-secondary' />
          <span className='text-text-secondary'>Hit dice</span>
          <span className='font-semibold tabular-nums'>
            {hitDice.value ?? '–'}/{hitDice.max ?? '–'} {hitDice.die}
          </span>
        </span>
      )}
    </li>
  )
}

/** Uses left of a limited feature: 1/3, in ruby when none are left. */
export function UsesLeft({ uses }: Readonly<{ uses: SheetUses }>) {
  return (
    <span
      className={clsx(
        'shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
        uses.value === 0 ? 'border-ruby/40 text-ruby' : 'border-border',
      )}
    >
      <span aria-hidden>
        {uses.value}/{uses.max}
      </span>
      <span className='sr-only'>
        {uses.value} of {uses.max} uses left
      </span>
    </span>
  )
}

/** The name of what a group of features came from: its class, species or background. */
function originName(sheet: TableSheet, id: string): string | undefined {
  if (id === 'species') return sheet.species ?? undefined
  if (id === 'background') return sheet.background ?? undefined
  return sheet.classes.find(entry => entry.identifier === id)?.name
}

function join(...parts: (string | null | undefined)[]): string | undefined {
  const present = parts.filter(Boolean)
  return present.length > 0 ? present.join(' · ') : undefined
}
