import { reasons } from '@/utils/roll-reasons'
import { articled, canReturn, isIncapacitated } from '@/utils/wild-shape'
import {
  attackWords,
  badgeName,
  badgeOf,
  LIST_UNREAD_WORDS,
  listFailedWords,
  ROW_WORDS,
  sizeCrWords,
  wildShapeReasons,
} from '@/utils/wild-shape-words'
import type { Focus, Op, RowState, Sent, View, WildShapeValue } from './types'
import type { SeatRole } from '@/types/seats'
import type { KnownForm } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { KeyboardEvent, RefObject } from 'react'

/**
 * Whether the sheet says what the game made of a command: the form taken, as its profile; no
 * form, once returned; the Beast known, in the place it replaced, if it replaced one.
 */
export function agrees(sent: Sent, sheet: TableSheet): boolean {
  switch (sent.op) {
    case 'transform': {
      return sheet.form?.profile === sent.form
    }
    case 'revert': {
      return !sheet.form
    }
    case 'learn': {
      return !!sheet.wildShape?.known.some(
        known =>
          known.uuid === sent.uuid &&
          (sent.replace === null || known.id === sent.replace),
      )
    }
  }
}

/** Where a dialog's Back is, by its name, for focus to go to as its view opens. */
export function backButton(label: string): Focus {
  return { selector: `button[aria-label="${label}"]` }
}

/** What the Wild Shape row says and offers, by the state it's in (round 0.40.0 §5.7). */
export function rowOf(ws: WildShapeValue): RowState | undefined {
  const { block, form, sheet, name } = ws
  if (!block || !sheet) return undefined
  if (form && !canReturn(sheet)) {
    return { line: ROW_WORDS.other(name, form.name), back: false }
  }
  const lines: string[] = []
  if (form) lines.push(ROW_WORDS.shaped(name, form.name))
  const left = block.uses.value > 0
  let change: 'on' | 'off' | undefined
  if (isIncapacitated(sheet)) {
    lines.push(ROW_WORDS.incapacitated(name))
    change = 'off'
  } else if (left) {
    if (!form) lines.push(ROW_WORDS.ready(block.hours))
    change = 'on'
  } else {
    lines.push(ROW_WORDS.spent(block.resurgence))
    change = 'off'
  }
  return { line: lines.join(' '), change, back: !!form }
}

/** Whether a row, by its id, is the character's Wild Shape row, while it may be used from here. */
export function isRow(ws: WildShapeValue, id: string): boolean {
  return ws.on && ws.pane && ws.block?.item === id
}

/** The dialog's title for each view. */
export function titleOf(view: View | undefined): string {
  switch (view?.kind) {
    case 'known': {
      return 'Known forms'
    }
    case 'learn': {
      return view.replace
        ? `Replace ${articled(view.replace.name)}`
        : 'Learn a form'
    }
    default: {
      return 'Wild Shape'
    }
  }
}

/** A known form's statistics: its AC, at the Moon's floor where higher, speeds and attack. */
export function formStats(
  known: KnownForm,
  acFloor: number | null,
): { ac?: string; speeds?: string; attack?: string } {
  const ac =
    typeof known.ac === 'number'
      ? `AC ${Math.max(known.ac, acFloor ?? Number.NEGATIVE_INFINITY)}`
      : undefined
  return {
    ac,
    speeds: known.speeds?.length ? known.speeds.join(', ') : undefined,
    attack: known.attack ? attackWords(known.attack) : undefined,
  }
}

/** A known form's card's accessible name: what its face says, and why it isn't offered. */
export function cardName(
  known: KnownForm,
  acFloor: number | null,
  now: boolean,
): string {
  const stats = known.pool ? formStats(known, acFloor) : {}
  const cr = known.pool ? sizeCrWords(undefined, known.cr) : ''
  const badge = badgeOf(known)
  let end = ''
  if (now) end = ', now'
  else if (badge) end = badgeName(badge)
  return [
    known.name,
    known.pool ? known.size : undefined,
    cr,
    stats.ac,
    stats.speeds,
    stats.attack,
  ]
    .filter(Boolean)
    .join(', ')
    .concat(end)
}

/** Which way each arrow key moves through a roving radiogroup. */
const STEPS: Record<string, 1 | -1> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
}

/** The card a roving radiogroup's arrow lands on: the next offered, wrapping, either way. */
function nextOffered(
  ids: string[],
  from: string | undefined,
  key: string,
): string | undefined {
  const step = STEPS[key]
  if (ids.length === 0 || step === undefined) return undefined
  const at = from === undefined ? -1 : ids.indexOf(from)
  if (at === -1) return step > 0 ? ids[0] : ids.at(-1)
  return ids[(at + step + ids.length) % ids.length]
}

/** Arrow keys on a roving radiogroup: the next offered card checked, and focused. */
export function arrows(
  event: KeyboardEvent<HTMLElement>,
  ids: string[],
  from: string | undefined,
  choose: (id: string) => void,
  attribute: string,
) {
  const next = nextOffered(ids, from, event.key)
  if (next === undefined) return
  event.preventDefault()
  choose(next)
  event.currentTarget
    .querySelector<HTMLElement>(
      `[${CSS.escape(attribute)}="${CSS.escape(next)}"]`,
    )
    ?.focus()
}

/** The words for why a command wasn't made, as the seat reads them. */
export function reasonWords(
  role: SeatRole,
  op: Op,
  key: string,
): string | undefined {
  return wildShapeReasons(role, op)[key] ?? reasons(role)[key]
}

/**
 * Why the Beasts to learn aren't listed, as the seat reads it: why the game couldn't list them; or,
 * where the app took the read with no id to follow it by (`unfollowed`), that they couldn't be read
 * back this time.
 */
export function beastsFailedWords(role: SeatRole, key: string): string {
  if (key === 'unfollowed') return LIST_UNREAD_WORDS
  const reason = reasonWords(role, 'learn', key) ?? 'something went wrong'
  return listFailedWords(role, reason)
}

/**
 * The dialog the Wild Shape dialog's body is drawn in, where it's open, for focus to be found in.
 */
export function dialogOf(
  body: RefObject<HTMLDivElement | null>,
): HTMLDialogElement | undefined {
  return body.current?.closest('dialog') ?? undefined
}
