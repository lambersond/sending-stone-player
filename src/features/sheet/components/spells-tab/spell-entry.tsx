'use client'

import clsx from 'clsx'
import { Wand } from 'lucide-react'
import { joinParts } from '../../utils/join-parts'
import { ActionEntry } from '../action-entry/action-entry'
import { componentsOf, whyNot } from '../action-info/utils'
import { spellOrigin } from '../description-actions/utils'
import { enchantedEntry } from '../enchantments/enchanted-entry'
import { usePrepareChoice } from '../preparing/use-prepare-choice'
import { SheetEntry } from '../sheet-entry/sheet-entry'
import { UsesLeft } from '../uses-button/uses-left'
import { factsOf, fromNote } from './utils'
import { spellAction } from '@/utils/sheet-actions'
import type { ActionRows } from '../action-entry/types'
import type { FavoriteTarget } from '@/types/roll'
import type { SheetSpell } from '@/types/sending-stone'
import type { ReactNode } from 'react'

/**
 * A spell: when and how it is cast, marked for concentration, ritual or always prepared. One not
 * prepared is muted, and says so. Given the rows actions are in, one that rolls shows what it rolls
 * beside it, as an action does: one not prepared is rolled here only, as the game would have it
 * prepared. From module 0.42.1, its menu prepares it or unprepares it, where the pane offers that.
 */
export function SpellEntry({
  characterId,
  spell,
  rows,
  favorite,
}: Readonly<{
  characterId: string
  spell: SheetSpell
  rows?: ActionRows
  /** What its row's favorites entry adds or removes, from module 0.37.0: the spell, unless said. */
  favorite?: FavoriteTarget | null
}>) {
  // Asked whichever it's drawn as, before either is returned; an action's row asks it itself.
  const prepare = usePrepareChoice(spell.id)
  const unprepared = spell.prepared === 0
  const components = componentsOf(spell)
  // A spell its item can't cast now is listed, but can't be cast, and says why: first, where a
  // narrow row cuts the rest short, and once it's open.
  const unusable = spell.castFrom?.usable === false ? spell.castFrom : undefined
  const meta = joinParts(
    spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`,
    spell.school,
    unprepared && 'Not prepared',
    unusable && `${whyNot(unusable)} · From ${unusable.name}`,
  )
  const marked =
    unprepared || spell.concentration || spell.ritual || spell.prepared === 2
  const action = rows && spellAction(spell)
  if (rows && action) {
    return (
      <ActionEntry
        action={action}
        rows={rows}
        favorite={favorite}
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
  const aside = (marked || spell.uses) && (
    <span className='flex shrink-0 items-center gap-1'>
      <Marks spell={spell} />
      {spell.uses && <UsesLeft uses={spell.uses} />}
    </span>
  )
  return (
    <SheetEntry
      characterId={characterId}
      name={spell.name}
      img={spell.img}
      fallback={Wand}
      favoriteKey={`item:${spell.id}`}
      favorite={favorite}
      prepareChoice={prepare}
      detail={
        unusable
          ? joinParts(whyNot(unusable), fromNote(unusable), spell.activation)
          : joinParts(
              spell.activation,
              spell.range,
              spell.castFrom && fromNote(spell.castFrom),
            )
      }
      aside={unprepared ? <BelowName>{aside}</BelowName> : aside}
      // Its "Not prepared" mark is wider than the others: in a narrow list, as on a phone or in the
      // desk's Favorites column, beneath the name rather than cutting it short.
      wraps={unprepared}
      meta={meta}
      facts={factsOf([
        ['Casting time', spell.activation],
        ['Range', spell.range],
        ['Target', spell.target],
        ['Duration', spell.duration],
        ['Components', components],
      ])}
      text={spell.text}
      origin={{ name: spellOrigin(spell), item: spell.id }}
      muted={unprepared || !!unusable}
      {...enchantedEntry(spell)}
    />
  )
}

/** A spell's marks: for concentration, ritual or always prepared, and not prepared. */
function Marks({ spell }: Readonly<{ spell: SheetSpell }>) {
  return (
    <>
      {/* In words, from 0.42.1, as the row's fade alone says other things too, as no slots left;
          its text is its name. In the text's own colour rather than the other marks' grey, which
          the row's fade would leave too faint to read. */}
      {spell.prepared === 0 && (
        <span className={clsx(MARK_BOX, 'whitespace-nowrap text-text-primary')}>
          Not prepared
        </span>
      )}
      {spell.concentration && <Mark short='C' label='Concentration' />}
      {spell.ritual && <Mark short='R' label='Ritual' />}
      {spell.prepared === 2 && <Mark short='Always' label='Always prepared' />}
    </>
  )
}

/** How a spell's mark is drawn: small, bordered and in capitals. */
const MARK_BOX =
  'rounded border border-border px-1 text-[10px] leading-4 font-bold tracking-wide uppercase'

/** How a spell's mark looks: as drawn, in grey. */
const MARK = `${MARK_BOX} text-text-secondary`

/** A spell's mark, such as C for concentration, spelled out for screen readers. */
function Mark({ short, label }: Readonly<{ short: string; label: string }>) {
  return (
    <span title={label} className={MARK}>
      <span aria-hidden>{short}</span>
      <span className='sr-only'>{label}</span>
    </span>
  )
}

/**
 * A spell row's marks on a line of their own beneath its name in a narrow list, where the list
 * it's in, a container, is under 28rem wide, lined up with the name past the icon: for a row given
 * `wraps`, which lets them go there (round 0.42.1 §P review).
 */
function BelowName({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className='@max-md:order-last @max-md:basis-full @max-md:pl-11'>
      {children}
    </span>
  )
}
