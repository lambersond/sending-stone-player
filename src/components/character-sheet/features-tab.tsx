'use client'

import clsx from 'clsx'
import { BookOpen, Sparkles } from 'lucide-react'
import {
  ActionEntry,
  useActionRows,
  type ActionRows,
  type TableDamage,
} from './action-entry'
import { enchantedEntry } from './enchantments'
import { useFavoriteChoice } from './favoriting'
import { hitDiceText } from './hit-dice'
import { useItemMenu } from './item-menu'
import { usePressMenu } from './press-menu'
import { joinParts, SheetEntry } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import { UsesButton } from './uses-button'
import { useSheetId } from '@/hooks/use-sheet-ids'
import { rechargeWords } from '@/utils/creature-words'
import { featureAction } from '@/utils/sheet-actions'
import type {
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/hooks/use-sheet-roller'
import type { FavoriteTarget } from '@/types/roll'
import type {
  SheetAction,
  SheetClass,
  SheetFeature,
  SheetUses,
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
    sheet,
    onRoll,
    onRollDamage,
    onRollFormula,
    onUse,
    tableDamage,
  })
  // Unique on the page, where a companion's pane is mounted beside its character's.
  const classesId = useSheetId('classes-heading')
  const sectionId = useSheetId('features-')
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {sheet.classes.length > 0 && (
        <section aria-labelledby={classesId} className='flex flex-col gap-2'>
          <SheetHeading id={classesId}>Classes</SheetHeading>
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
          aria-labelledby={`${sectionId}${section.id}`}
          className='flex flex-col gap-2'
        >
          <SheetHeading id={`${sectionId}${section.id}`}>
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
 * are in, one that rolls shows what it rolls beside it, as an action does. Among the favorites, it
 * may show other uses in place of its own, such as those of a resource it stands for, with a note
 * first.
 */
export function FeatureEntry({
  characterId,
  feature,
  rows,
  uses,
  note,
  favorite,
}: Readonly<{
  characterId: string
  feature: SheetFeature
  rows?: ActionRows
  /**
   * Uses to show in place of its own, only shown, and shown however narrow the list; null for
   * none.
   */
  uses?: SheetUses | null
  /** What to say of it first, such as the name of the resource it stands for. */
  note?: string
  /**
   * What its row's favorites entry adds or removes, from module 0.37.0: the feature, unless said;
   * null for none, as among the favorites for a resource's.
   */
  favorite?: FavoriteTarget | null
}>) {
  const meta = joinParts(feature.kind, feature.requirements)
  const action = rows && featureAction(feature)
  if (rows && action) {
    return (
      <ActionEntry
        action={action}
        rows={rows}
        note={note}
        look={{ meta, uses }}
        favorite={favorite}
      />
    )
  }
  const shown = uses === undefined ? feature.uses : uses
  return (
    <SheetEntry
      characterId={characterId}
      name={feature.name}
      img={feature.img}
      fallback={Sparkles}
      favoriteKey={`item:${feature.id}`}
      favorite={favorite}
      detail={joinParts(
        note,
        feature.activation ?? (feature.passive ? 'Passive' : undefined),
        // As dnd5e's stat block says a recharge, from module 0.36.0, not "Recharge [5+]".
        feature.uses?.recharge
          ? rechargeWords(feature.uses.recharge)
          : feature.uses?.recovery,
      )}
      aside={shown && <UsesButton uses={shown} name={feature.name} />}
      meta={meta}
      text={feature.text}
      origin={{ name: feature.name, item: feature.id }}
      {...enchantedEntry(feature)}
    />
  )
}

/**
 * A class: its levels, then its subclass and hit dice. From module 0.37.0, where the sheet names
 * it by its id, a menu of its own, Add to favorites or Remove from favorites, where the pane offers
 * them, and a tab stop then, for the keyboard to open it.
 */
function ClassCard({ entry }: Readonly<{ entry: SheetClass }>) {
  const { hitDice } = entry
  const detail = joinParts(entry.subclass, hitDice && hitDiceText(hitDice))
  const { onMenu, menu } = useItemMenu(entry.name, {
    favorite: useFavoriteChoice(
      entry.id ? { type: 'item', id: entry.id } : undefined,
      entry.name,
    ),
  })
  const press = usePressMenu(onMenu)
  return (
    <>
      <li
        tabIndex={onMenu ? 0 : undefined}
        {...press.props}
        className={clsx(
          'rounded-2xl border border-border bg-card px-4 py-3',
          onMenu &&
            'outline-none focus-visible:ring-2 focus-visible:ring-primary',
          press.className,
        )}
      >
        <span className='block truncate font-semibold'>
          {entry.name}
          {entry.levels !== null && ` ${entry.levels}`}
        </span>
        {/* Wrapping, not cut short, so a long subclass leaves the hit dice in sight. */}
        {detail && (
          <span className='block text-sm text-text-secondary'>{detail}</span>
        )}
      </li>
      {/* Beside the card, not in it: the menu's events reach what holds it in React's tree,
          though it's drawn elsewhere, and the card's press would take a held tap on an entry as
          its own. */}
      {menu}
    </>
  )
}

/** The name of what a group of features came from: its class, species or background. */
function originName(sheet: TableSheet, id: string): string | undefined {
  if (id === 'species') return sheet.species ?? undefined
  if (id === 'background') return sheet.background ?? undefined
  return sheet.classes.find(entry => entry.identifier === id)?.name
}
