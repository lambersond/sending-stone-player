'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import { LoaderCircle, Package } from 'lucide-react'
import { CharacterPane } from '@/components/character-sheet/character-pane'
import { useCompanionView } from '@/hooks/use-companion-view'
import { TableApiContext } from '@/hooks/use-table-api'
import { megabytes } from '@/utils/format-amount'
import { seatWords } from '@/utils/seat-words'
import type { TableSeat } from '@/types/character'
import type { SheetWithheld } from '@/types/sending-stone'
import type { CreatureFacts } from '@/types/table'
import type { RowCompanion } from '@/utils/companion-row'

/**
 * A companion's pane beside its character's, as its tab's panel (module 0.36.0): its own sheet,
 * read through its own routes, rolling as itself, its tray and toasts its own, its dice thrown on
 * the page's one renderer. Its view is asked for as it mounts, then kept current only while it's
 * shown. While its sheet hasn't come, or was too large to send, it says so, and takes focus itself,
 * handing it to its sheet's tabs once the sheet comes. Once the companion is no longer the
 * character's, its sheet stays as it was, a note under its tabs saying so, and nothing on it rolls.
 * @param companion - As the row has it.
 * @param name - Its name as the row says it, numbered where repeated, such as "Bat 2".
 * @param character - The character's name.
 * @param shown - Whether it's the pane shown.
 * @param gone - Whether the row marks it gone.
 * @param manualDice - The character's own way of typing in their dice, which a companion's follow.
 */
export function CompanionPane({
  seat,
  companion,
  name,
  character,
  shown,
  gone,
  onPending,
  onBusy,
  onLost,
  header,
  manualDice,
}: Readonly<{
  seat: TableSeat
  companion: RowCompanion
  name: string
  character: string
  shown: boolean
  gone: boolean
  onPending?: (pending: boolean) => void
  onBusy?: (busy: boolean) => void
  /**
   * Told once its route says it's gone (404), which the row may still list, as one that left and
   * came back between two of the page's polls: its view is asked for no more after.
   */
  onLost?: () => void
  /** The table's header, which its toasts start below where its tabs aren't shown. */
  header?: HTMLElement | null
  manualDice?: { on: boolean; onChange: (on: boolean) => void }
}>) {
  const { key } = companion
  const api = `${seat.api}/companions/${key}`
  const characterId = `${seat.key}:c:${key}`
  // Its rolls, texts and follows go through its own routes, under its own key.
  const own = useMemo(
    () => ({ role: seat.role, api, key: characterId }),
    [seat.role, api, characterId],
  )
  const { view, gone: lost } = useCompanionView(api, { active: shown })
  const left = gone || lost || view?.connected === false
  // So that the page mounts it afresh, where its next view still lists the companion.
  useEffect(() => {
    if (lost) onLost?.()
  }, [lost, onLost])
  const { game } = seatWords(seat.role)
  // Whose it is, for its header and the words its tray says.
  const { kind, from } = companion
  const creature = useMemo<CreatureFacts>(
    () => ({
      name,
      relation:
        kind === 'summoned'
          ? { kind, of: character, ...(from && { from }) }
          : { kind: 'owned', of: character },
    }),
    [name, kind, from, character],
  )

  // Focus on the panel while its sheet was on its way moves into the sheet's own tabs as it comes.
  const panel = useRef<HTMLDivElement>(null)
  const focused = useRef(false)
  const ready = view?.sheet !== undefined
  useLayoutEffect(() => {
    if (!ready || !focused.current) return
    focused.current = false
    panel.current
      ?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
      ?.focus()
  }, [ready])

  let body
  if (view?.sheet) {
    body = (
      <CharacterPane
        characterId={characterId}
        name={name}
        sheet={view.sheet}
        combat={view.combat}
        // A companion no longer the character's has nothing made in the game.
        rollsToTable={left ? undefined : view.rollsToTable}
        rollFeatures={left ? undefined : view.rollFeatures}
        gmRolls={view.gmRolls}
        header={header}
        manualDice={view.manualDice?.offered ? manualDice : undefined}
        creature={creature}
        shown={shown}
        onPending={onPending}
        onBusy={onBusy}
        sharedDice
        follows={view.initiative.after}
        locked={left}
        idPrefix={`creature-${key}-`}
        // Under the sheet's tab row, as the prototype draws it.
        note={
          left && <GoneNote name={name} character={character} game={game} />
        }
      />
    )
  } else if (left) {
    body = <GoneNote name={name} character={character} game={game} short />
  } else {
    body = <NoCreatureSheet name={name} withheld={view?.sheetWithheld} />
  }

  return (
    <TableApiContext value={own}>
      <div
        ref={panel}
        role='tabpanel'
        id={`creature-panel-${key}`}
        aria-labelledby={`creature-tab-${key}`}
        hidden={!shown}
        // With no sheet to show yet, the panel itself is in the Tab order.
        tabIndex={ready ? undefined : 0}
        onFocus={event => {
          if (event.target === event.currentTarget) focused.current = true
        }}
        onBlur={event => {
          if (event.target === event.currentTarget) focused.current = false
        }}
        className={clsx(
          'min-h-0 min-w-0 flex-1 flex-col',
          shown ? 'flex' : 'hidden',
        )}
      >
        {body}
      </div>
    </TableApiContext>
  )
}

/**
 * Says a companion is no longer its character's in the game, as a note under the tabs of its
 * sheet, kept as it was; or alone, where its sheet never came.
 * @param short - With no sheet under it.
 */
export function GoneNote({
  name,
  character,
  game,
  short = false,
}: Readonly<{
  name: string
  character: string
  /** The game, in a sentence, as the seat says it. */
  game: string
  short?: boolean
}>) {
  return (
    <p
      role='note'
      className='shrink-0 border-b border-warning/40 bg-warning/10 px-4 py-2.5 text-sm md:px-8'
    >
      {short
        ? `${name} is no longer with ${character} in ${game}.`
        : `${name} is no longer with ${character} in ${game}. Its sheet is as it was; nothing more can be rolled for it here.`}
    </p>
  )
}

/**
 * In place of a companion's sheet, while it hasn't come; or for one the module held back, as too
 * large to send, how large it was, where it said.
 */
export function NoCreatureSheet({
  name,
  withheld,
}: Readonly<{ name: string; withheld?: SheetWithheld }>) {
  const large = withheld?.reason === 'tooLarge'
  let words = `${name}’s sheet hasn’t arrived yet.`
  if (large) {
    words =
      typeof withheld.bytes === 'number'
        ? `${name}’s sheet is too large to send (${megabytes(withheld.bytes, Math.ceil)}).`
        : `${name}’s sheet is too large to send.`
  }
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center'>
      {large ? (
        <span className='flex size-12 items-center justify-center rounded-2xl bg-warning/10 text-warning'>
          <Package aria-hidden className='size-6' />
        </span>
      ) : (
        <span className='flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary-text'>
          <LoaderCircle
            aria-hidden
            className='size-6 motion-safe:animate-spin'
          />
        </span>
      )}
      <p className={clsx('font-semibold', large && 'max-w-sm')}>{words}</p>
    </div>
  )
}
