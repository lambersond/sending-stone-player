'use client'

import { useState, type ReactNode } from 'react'
import { useActionRows } from '../action-entry/use-action-rows'
import { SheetFact } from '../sheet-fact/sheet-fact'
import { SheetHeading } from '../sheet-heading/sheet-heading'
import { SpellSlots } from '../spell-slots/spell-slots'
import { WildShapeNote } from '../wild-shape/wild-shape-note'
import { SpellEntry } from './spell-entry'
import { foundOf, preparedCount } from './utils'
import { SearchField } from '@/components/search-field/search-field'
import { useSheetId } from '@/features/sheet/hooks/use-sheet-ids'
import { formatModifier } from '@/utils/format-modifier'
import { matchesSearch, searchKey } from '@/utils/search'
import type { TableDamage } from '../action-entry/types'
import type {
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
  DamageModifiers,
} from '@/types/roll'
import type { SheetAction, SheetSpellcasting } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/** How many spells a character has before their spells can be searched. */
const SEARCH_FROM = 5

/**
 * The character's spells, as dnd5e's Spells tab shows them to its player: how they cast, then
 * their spellbook in its sections, such as Cantrips and each spell level, with the slots left.
 * Each spell opens to its description. What a spell rolls is beside it, as on the Actions tab: its
 * attack, saving throw and damage or healing, each a button that rolls it, or casts it in the
 * Gamemaster's game while the game takes spells. With more than a few spells, they can be searched
 * by name, word by word, whatever its case or accents.
 */
export function SpellsTab({
  characterId,
  sheet,
  favorites,
  onRoll,
  onRollDamage,
  onRollFormula,
  onUse,
  tableDamage,
}: Readonly<{
  characterId: string
  sheet: TableSheet
  /** Shown first, such as the character's favorites. */
  favorites?: ReactNode
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Rolls an activity's own formula, such as a light's radius. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Casts a spell in the Gamemaster's game, while it takes them. */
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
  const sectionId = useSheetId('spells-')
  const [query, setQuery] = useState('')
  const count = sheet.spells.reduce(
    (total, section) => total + section.spells.length,
    0,
  )
  const searchable = count >= SEARCH_FROM
  const search = searchable && searchKey(query) !== ''
  // A spell level with slots shows even with no spells of its own, as they can cast a lower
  // level's; while searching, only those with a spell found.
  const sections = sheet.spells
    .map(section =>
      search
        ? {
            ...section,
            spells: section.spells.filter(spell =>
              matchesSearch([spell.name], query),
            ),
          }
        : section,
    )
    .filter(
      section =>
        section.spells.length > 0 || (!search && (section.slots?.max ?? 0) > 0),
    )
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {/* While transformed, as by Wild Shape (module 0.40.0): what the form may cast. */}
      <WildShapeNote tab='spells' />
      {favorites}
      {sheet.spellcasting && <Spellcasting spellcasting={sheet.spellcasting} />}
      {searchable && (
        <SearchField
          value={query}
          onChange={setQuery}
          label='Search spells by name'
          placeholder='Search spells'
        />
      )}
      {/* What a search finds, as a screen reader is told while typing; the tray's is the page's
          status. */}
      {searchable && (
        <p aria-live='polite' className='sr-only'>
          {search && foundOf(sections)}
        </p>
      )}

      {sections.map(section => (
        <section
          key={section.id}
          aria-labelledby={`${sectionId}${section.id}`}
          className='flex flex-col gap-2'
        >
          {/* The dots go beneath the heading before anything scrolls sideways: from module 0.42.1
              each is a button a finger wide, and nine of them beside "Pact Magic — 3rd Level"
              don't fit a phone. */}
          <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1'>
            <SheetHeading id={`${sectionId}${section.id}`}>
              {section.label}
            </SheetHeading>
            {section.slots && section.slots.max > 0 && (
              <SpellSlots
                value={section.slots.value}
                max={section.slots.max}
                pool={{ id: section.id, level: section.slots.level ?? null }}
              />
            )}
          </div>
          {section.spells.length > 0 ? (
            // A container, so that each row fits the list it's in.
            <ul className='@container rounded-2xl border border-border bg-card p-1.5'>
              {section.spells.map(spell => (
                <SpellEntry
                  key={spell.id}
                  characterId={characterId}
                  spell={spell}
                  rows={rows}
                />
              ))}
            </ul>
          ) : (
            <p className='text-sm text-text-secondary'>
              No spells of this level.
            </p>
          )}
        </section>
      ))}

      {sections.length === 0 && (
        <p className='text-sm text-text-secondary'>
          {search
            ? `No spells match “${query.trim()}”.`
            : 'No spells to show yet.'}
        </p>
      )}

      {dialogs}
    </div>
  )
}

/**
 * How the character casts: their spellcasting ability, spell save DC and spell attack bonus, and
 * each spellcasting class's when they have more than one. From module 0.42.1, how many spells each
 * class has prepared, of how many, as dnd5e's sheet shows it: the class's own where there's one,
 * else on each class's row.
 */
function Spellcasting({
  spellcasting,
}: Readonly<{ spellcasting: SheetSpellcasting }>) {
  const { ability, dc, attack, classes } = spellcasting
  const headingId = useSheetId('spellcasting-heading')
  const prepared =
    classes.length === 1 ? preparedCount(classes[0].prepared) : undefined
  if (ability === null && dc === null && attack === null && !prepared) return
  return (
    <section aria-labelledby={headingId} className='flex flex-col gap-2'>
      <SheetHeading id={headingId}>Spellcasting</SheetHeading>
      <dl className='grid grid-cols-2 gap-2 @lg:grid-cols-3'>
        {ability && (
          <SheetFact label='Ability' className='col-span-2 @lg:col-span-1'>
            <span className='text-lg font-bold'>{ability}</span>
          </SheetFact>
        )}
        {dc !== null && (
          <SheetFact label='Spell save DC'>
            <span className='text-lg font-bold tabular-nums'>{dc}</span>
          </SheetFact>
        )}
        {attack !== null && (
          <SheetFact label='Spell attack'>
            <span className='text-lg font-bold tabular-nums'>
              {formatModifier(attack)}
            </span>
          </SheetFact>
        )}
        {prepared && (
          <SheetFact label='Prepared' className='col-span-2 @lg:col-span-1'>
            <span aria-hidden className='text-lg font-bold tabular-nums'>
              {prepared.shown}
            </span>
            <span className='sr-only'>{prepared.said}</span>
          </SheetFact>
        )}
      </dl>
      {classes.length > 1 && (
        <ul
          aria-label='By class'
          className='rounded-2xl border border-border bg-card p-1.5'
        >
          {classes.map(entry => (
            <li
              key={entry.name}
              className='flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2.5 py-2'
            >
              <span className='min-w-0 flex-auto'>
                <span className='block truncate font-medium'>{entry.name}</span>
                {entry.ability && (
                  <span className='block truncate text-xs text-text-secondary'>
                    {entry.ability}
                  </span>
                )}
              </span>
              {/* Beside the name where they fit, else beneath it at the row's end, so that the
                  prepared count, from module 0.42.1, never cuts the name short on a phone. */}
              {(entry.dc !== null ||
                entry.attack !== null ||
                !!preparedCount(entry.prepared)) && (
                <span className='ml-auto flex flex-wrap items-center justify-end gap-x-3'>
                  {entry.dc !== null && (
                    <span className='shrink-0 text-sm'>
                      <span className='text-text-secondary'>DC </span>
                      <span className='font-semibold tabular-nums'>
                        {entry.dc}
                      </span>
                    </span>
                  )}
                  {entry.attack !== null && (
                    <span className='shrink-0 text-sm'>
                      <span className='font-semibold tabular-nums'>
                        {formatModifier(entry.attack)}
                      </span>
                      <span className='text-text-secondary'> to hit</span>
                    </span>
                  )}
                  <ClassPrepared prepared={entry.prepared} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * How many of a class's spells are prepared, on its row, where the character has more than one
 * spellcasting class (module 0.42.1): "Prepared 5 / 6", read "Prepared 5 of 6".
 */
function ClassPrepared({
  prepared,
}: Readonly<{ prepared: SheetSpellcasting['classes'][number]['prepared'] }>) {
  const count = preparedCount(prepared)
  if (!count) return
  return (
    <span className='shrink-0 text-sm'>
      <span aria-hidden>
        <span className='text-text-secondary'>Prepared </span>
        <span className='font-semibold tabular-nums'>{count.shown}</span>
      </span>
      <span className='sr-only'>Prepared {count.said}</span>
    </span>
  )
}
