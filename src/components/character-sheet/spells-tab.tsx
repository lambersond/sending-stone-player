'use client'

import { useState, type ReactNode } from 'react'
import { Search, Wand } from 'lucide-react'
import {
  ActionEntry,
  useActionRows,
  type ActionRows,
  type TableDamage,
} from './action-entry'
import { joinParts, SheetEntry } from './sheet-entry'
import { SheetFact } from './sheet-fact'
import { SheetHeading } from './sheet-heading'
import { SpellSlots } from './spell-slots'
import { UsesLeft } from './uses-left'
import { formatModifier } from '@/utils/format-modifier'
import { spellAction } from '@/utils/sheet-actions'
import type { SheetDamageRoll, SheetRoll } from '@/hooks/use-sheet-roller'
import type {
  SheetAction,
  SheetCastFrom,
  SheetSpell,
  SheetSpellcasting,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { DamageModifiers } from '@/utils/damage-modifiers'

/** How many spells a character has before their spells can be searched. */
const SEARCH_FROM = 5

/**
 * The character's spells, as dnd5e's Spells tab shows them to its player: how they cast, then
 * their spellbook in its sections, such as Cantrips and each spell level, with the slots left.
 * Each spell opens to its description. What a spell rolls is beside it, as on the Actions tab: its
 * attack, saving throw and damage or healing, each a button that rolls it, or casts it in the
 * Gamemaster's game while the game takes spells. With more than a few spells, they can be searched
 * by name.
 */
export function SpellsTab({
  characterId,
  sheet,
  favorites,
  onRoll,
  onRollDamage,
  onUse,
  tableDamage,
}: Readonly<{
  characterId: string
  sheet: TableSheet
  /** Shown first, such as the character's favorites. */
  favorites?: ReactNode
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Casts a spell in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
}>) {
  const { rows, dialogs } = useActionRows({
    characterId,
    spellbook: sheet.spells,
    onRoll,
    onRollDamage,
    onUse,
    tableDamage,
  })
  const [query, setQuery] = useState('')
  const count = sheet.spells.reduce(
    (total, section) => total + section.spells.length,
    0,
  )
  const searchable = count >= SEARCH_FROM
  const search = searchable ? query.trim().toLocaleLowerCase() : ''
  // A spell level with slots shows even with no spells of its own, as they can cast a lower
  // level's; while searching, only those with a spell found.
  const sections = sheet.spells
    .map(section =>
      search
        ? {
            ...section,
            spells: section.spells.filter(spell =>
              spell.name.toLocaleLowerCase().includes(search),
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
      {favorites}
      {sheet.spellcasting && <Spellcasting spellcasting={sheet.spellcasting} />}
      {searchable && <SpellSearch query={query} onChange={setQuery} />}

      {sections.map(section => (
        <section
          key={section.id}
          aria-labelledby={`spells-${section.id}`}
          className='flex flex-col gap-2'
        >
          <div className='flex items-center justify-between gap-3'>
            <SheetHeading id={`spells-${section.id}`}>
              {section.label}
            </SheetHeading>
            {section.slots && section.slots.max > 0 && (
              <SpellSlots value={section.slots.value} max={section.slots.max} />
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

/** A search of the character's spells by name, whatever its case. */
function SpellSearch({
  query,
  onChange,
}: Readonly<{ query: string; onChange: (query: string) => void }>) {
  return (
    <div className='relative'>
      <Search
        aria-hidden
        className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary'
      />
      <input
        type='search'
        value={query}
        onChange={event => onChange(event.target.value)}
        aria-label='Search spells by name'
        placeholder='Search spells'
        autoComplete='off'
        spellCheck={false}
        className='h-11 w-full rounded-xl border border-border bg-page pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-primary/40'
      />
    </div>
  )
}

/**
 * How the character casts: their spellcasting ability, spell save DC and spell attack bonus, and
 * each spellcasting class's when they have more than one.
 */
function Spellcasting({
  spellcasting,
}: Readonly<{ spellcasting: SheetSpellcasting }>) {
  const { ability, dc, attack, classes } = spellcasting
  if (ability === null && dc === null && attack === null) return
  return (
    <section
      aria-labelledby='spellcasting-heading'
      className='flex flex-col gap-2'
    >
      <SheetHeading id='spellcasting-heading'>Spellcasting</SheetHeading>
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
      </dl>
      {classes.length > 1 && (
        <ul
          aria-label='By class'
          className='rounded-2xl border border-border bg-card p-1.5'
        >
          {classes.map(entry => (
            <li
              key={entry.name}
              className='flex items-center gap-3 rounded-xl px-2.5 py-2'
            >
              <span className='min-w-0 flex-1'>
                <span className='block truncate font-medium'>{entry.name}</span>
                {entry.ability && (
                  <span className='block truncate text-xs text-text-secondary'>
                    {entry.ability}
                  </span>
                )}
              </span>
              {entry.dc !== null && (
                <span className='shrink-0 text-sm'>
                  <span className='text-text-secondary'>DC </span>
                  <span className='font-semibold tabular-nums'>{entry.dc}</span>
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
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * A spell: when and how it is cast, marked for concentration, ritual or always prepared. One not
 * prepared is muted. Given the rows actions are in, one that rolls shows what it rolls beside it,
 * as an action does: one not prepared is rolled here only, as the game would have it prepared.
 */
export function SpellEntry({
  characterId,
  spell,
  rows,
}: Readonly<{ characterId: string; spell: SheetSpell; rows?: ActionRows }>) {
  const unprepared = spell.prepared === 0
  const components = [
    spell.components,
    spell.materials && `(${spell.materials})`,
  ]
    .filter(Boolean)
    .join(' ')
  // A spell its item can't cast now is listed, but can't be cast, and says why in its detail.
  const unusable = spell.castFrom?.usable === false
  const meta = joinParts(
    spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`,
    spell.school,
    unprepared && 'Not prepared',
  )
  const marked =
    unprepared || spell.concentration || spell.ritual || spell.prepared === 2
  const action = rows && spellAction(spell)
  if (rows && action) {
    return (
      <ActionEntry
        action={action}
        rows={rows}
        note={spell.castFrom ? fromNote(spell.castFrom) : undefined}
        look={{
          marks: marked && (
            <span className='flex shrink-0 items-center gap-1'>
              <Marks spell={spell} />
            </span>
          ),
          meta,
          // How it's cast, its range and target are an action's.
          facts: factsOf([
            ['Duration', spell.duration],
            ['Components', components],
          ]),
          muted: unprepared,
        }}
      />
    )
  }
  return (
    <SheetEntry
      characterId={characterId}
      name={spell.name}
      img={spell.img}
      fallback={Wand}
      favoriteKey={`item:${spell.id}`}
      detail={joinParts(
        spell.activation,
        spell.range,
        spell.castFrom && fromNote(spell.castFrom),
      )}
      aside={
        (marked || spell.uses) && (
          <span className='flex shrink-0 items-center gap-1'>
            <Marks spell={spell} />
            {spell.uses && <UsesLeft uses={spell.uses} />}
          </span>
        )
      }
      meta={meta}
      facts={factsOf([
        ['Casting time', spell.activation],
        ['Range', spell.range],
        ['Target', spell.target],
        ['Duration', spell.duration],
        ['Components', components],
      ])}
      text={spell.text}
      muted={unprepared || unusable}
    />
  )
}

/**
 * The item a spell is cast from, such as "From Wand of Fireballs", and why it can't be cast now,
 * if it can't.
 */
function fromNote(castFrom: SheetCastFrom): string | undefined {
  return joinParts(
    `From ${castFrom.name}`,
    castFrom.usable === false && whyNot(castFrom),
  )
}

/** Why the item a spell is cast from can't cast it now: it needs attuning, or else it can't. */
function whyNot(castFrom: SheetCastFrom): string {
  return castFrom.attune ? 'Needs attuning' : 'Can’t be cast now'
}

/** A spell's marks: for concentration, ritual or always prepared, and not prepared, unseen. */
function Marks({ spell }: Readonly<{ spell: SheetSpell }>) {
  return (
    <>
      {spell.prepared === 0 && <span className='sr-only'>Not prepared</span>}
      {spell.concentration && <Mark short='C' label='Concentration' />}
      {spell.ritual && <Mark short='R' label='Ritual' />}
      {spell.prepared === 2 && <Mark short='Always' label='Always prepared' />}
    </>
  )
}

/** The facts there are of these, each with its label. */
function factsOf(
  specifics: [string, string | null][],
): { label: string; value: string }[] {
  return specifics.flatMap(([label, value]) =>
    value ? [{ label, value }] : [],
  )
}

/** A spell's mark, such as C for concentration, spelled out for screen readers. */
function Mark({ short, label }: Readonly<{ short: string; label: string }>) {
  return (
    <span
      title={label}
      className='rounded border border-border px-1 text-[10px] leading-4 font-bold tracking-wide text-text-secondary uppercase'
    >
      <span aria-hidden>{short}</span>
      <span className='sr-only'>{label}</span>
    </span>
  )
}
