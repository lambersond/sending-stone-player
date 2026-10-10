'use client'

import { BookOpen, Sparkles } from 'lucide-react'
import {
  ActionEntry,
  useActionRows,
  type ActionRows,
  type TableDamage,
} from './action-entry'
import { hitDiceText } from './hit-dice'
import { joinParts, SheetEntry } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import { UsesLeft } from './uses-left'
import { featureAction } from '@/utils/sheet-actions'
import type {
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/hooks/use-sheet-roller'
import type {
  SheetAction,
  SheetClass,
  SheetFeature,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { DamageModifiers } from '@/utils/damage-modifiers'

/**
 * The character's classes, with their hit dice, and features, grouped as dnd5e's Features tab
 * groups them: by the class, species or background each came from. Each opens to its
 * description. What a feature rolls is beside it, as on the Actions tab, each a button that rolls
 * it, or uses it in the Gamemaster's game while the game takes features. Hit dice are spent from
 * the Character tab, and a class's favorite, not here.
 */
export function FeaturesTab({
  characterId,
  sheet,
  onRoll,
  onRollDamage,
  onRollFormula,
  onUse,
  tableDamage,
}: Readonly<{
  characterId: string
  sheet: TableSheet
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Rolls a feature's own formula. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Uses a feature in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
}>) {
  const { rows, dialogs } = useActionRows({
    characterId,
    spellbook: sheet.spells,
    onRoll,
    onRollDamage,
    onRollFormula,
    onUse,
    tableDamage,
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
                origin={{
                  name: originName(sheet, section.id) ?? section.label,
                }}
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
      origin={{ name: feature.name, item: feature.id }}
    />
  )
}

/** A class: its levels, then its subclass and hit dice. */
function ClassCard({ entry }: Readonly<{ entry: SheetClass }>) {
  const { hitDice } = entry
  const detail = joinParts(entry.subclass, hitDice && hitDiceText(hitDice))
  return (
    <li className='rounded-2xl border border-border bg-card px-4 py-3'>
      <span className='block truncate font-semibold'>
        {entry.name}
        {entry.levels !== null && ` ${entry.levels}`}
      </span>
      {/* Wrapping, not cut short, so a long subclass leaves the hit dice in sight. */}
      {detail && (
        <span className='block text-sm text-text-secondary'>{detail}</span>
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
