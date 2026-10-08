'use client'

import { BookOpen, HeartPulse, Sparkles } from 'lucide-react'
import { ActionEntry, useActionRows, type ActionRows } from './action-entry'
import { joinParts, SheetEntry } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import { UsesLeft } from './uses-left'
import { featureAction } from '@/utils/sheet-actions'
import type { SheetDamageRoll, SheetRoll } from '@/hooks/use-sheet-roller'
import type {
  SheetAction,
  SheetClass,
  SheetFeature,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/**
 * The character's classes, with their hit dice, and features, grouped as dnd5e's Features tab
 * groups them: by the class, species or background each came from. Each opens to its
 * description. What a feature rolls is beside it, as on the Actions tab, each a button that rolls
 * it, or uses it in the Gamemaster's game while the game takes features.
 */
export function FeaturesTab({
  characterId,
  sheet,
  onRoll,
  onRollDamage,
  onUse,
}: Readonly<{
  characterId: string
  sheet: TableSheet
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Uses a feature in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction) => void
}>) {
  const { rows, dialogs } = useActionRows({
    characterId,
    spellbook: sheet.spells,
    onRoll,
    onRollDamage,
    onUse,
  })
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
          {/* A container, so that each row fits the list it's in. */}
          <ul className='@container rounded-2xl border border-border bg-card p-1.5'>
            {section.text && (
              <SheetEntry
                characterId={characterId}
                name={`About ${originName(sheet, section.id) ?? 'this'}`}
                fallback={BookOpen}
                text={section.text}
              />
            )}
            {section.features.map(feature => (
              <FeatureEntry
                key={feature.id}
                characterId={characterId}
                feature={feature}
                rows={rows}
              />
            ))}
          </ul>
        </section>
      ))}

      {sheet.features.length === 0 && (
        <p className='text-sm text-text-secondary'>No features to show yet.</p>
      )}

      {dialogs}
    </div>
  )
}

/**
 * A feature: how it's used and its uses left, opening to its description. Given the rows actions
 * are in, one that rolls shows what it rolls beside it, as an action does.
 */
export function FeatureEntry({
  characterId,
  feature,
  rows,
}: Readonly<{
  characterId: string
  feature: SheetFeature
  rows?: ActionRows
}>) {
  const meta = joinParts(feature.kind, feature.requirements)
  const action = rows && featureAction(feature)
  if (rows && action) {
    return <ActionEntry action={action} rows={rows} look={{ meta }} />
  }
  return (
    <SheetEntry
      characterId={characterId}
      name={feature.name}
      img={feature.img}
      fallback={Sparkles}
      favoriteKey={`item:${feature.id}`}
      detail={joinParts(
        feature.activation ?? (feature.passive ? 'Passive' : undefined),
        feature.uses?.recovery,
      )}
      aside={feature.uses && <UsesLeft uses={feature.uses} />}
      meta={meta}
      text={feature.text}
    />
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

/** The name of what a group of features came from: its class, species or background. */
function originName(sheet: TableSheet, id: string): string | undefined {
  if (id === 'species') return sheet.species ?? undefined
  if (id === 'background') return sheet.background ?? undefined
  return sheet.classes.find(entry => entry.identifier === id)?.name
}
