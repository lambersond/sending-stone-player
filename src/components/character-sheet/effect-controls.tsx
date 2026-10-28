'use client'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import {
  EFFECT_OPS,
  EFFECT_SETTLE,
  type EffectOp,
} from '@/constants/sending-stone'
import { EFFECT_WORDS, effectControlName } from '@/utils/effect-words'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type {
  EffectChange,
  SheetEffect,
  SheetEffectSection,
} from '@/types/sending-stone'

// What a pane offers of its character's own effects, from module 0.39.0, where the campaign lets
// its players change them: on each effect whose `ops` say so, Turn off, Turn on and Delete…, inside
// its opened row and in its menu, the module deciding which and the app checking again. Turned off
// or on, an effect moves to another of the tab's sections, its row drawn afresh there: so its row's
// open state is kept here, by where it's drawn and its id, for it to open again there, and focus,
// lost with the control pressed, follows it once the sheet agrees.

/** A row's effect controls: what may be done to it now, and whether a change of it waits. */
export type EffectChoice = {
  /** What may be done to it, as the sheet's `ops` say. */
  ops: EffectOp[]
  /** While a change of it is on its way, and once made until the sheet says so. */
  waiting: boolean
  /** The change on its way, whose button turns. */
  pending?: EffectOp
  choose: (op: EffectOp) => void
}

/** Where focus goes once a change chosen on a row is on the sheet. */
type Focusing = {
  effect: string
  op: EffectOp
  /** The change's local id, by which its way is followed. */
  id: string
  /**
   * For a delete, what's beside its row as it's deleted: the next row, then the one before, then
   * the tab's panel, the first still there taking focus once it has gone.
   */
  after: (Element | undefined)[]
}

/** What a pane knows of its character's own effects. */
export type Effects = {
  /** The character's name, which Delete's dialog says it's removed from. */
  character?: string
  choiceFor: (effect: SheetEffect) => EffectChoice | undefined
  /** One of the character's effects, by the sheet's id for it, from 0.42.1: none once it's gone. */
  effectOf: (id: string) => SheetEffect | undefined
  /**
   * Sends a change of an effect, where it may be sent now: its local id; none where it isn't. From
   * 0.42.1, `at` is when its line among the rolls is kept, where a roll made it, before that roll.
   */
  send: (effect: SheetEffect, op: EffectOp, at?: number) => string | undefined
  /** Whether this change of an effect, by its local id, waits. */
  waitingOf: (effect: string, id: string, op: EffectOp) => boolean
  /** Whether the row drawn at this key is open; none where the pane keeps no rows' state. */
  openAt: (key: string) => boolean | undefined
  setOpenAt: (key: string, open: boolean) => void
  /** Where focus goes once each change chosen on a row, by its key, is on the sheet. */
  focusing: RefObject<Map<string, Focusing>>
}

/**
 * None, as wherever a sheet's effects can't be changed: a party's sheet, a companion's pane, the
 * Gamemaster's page, a game that doesn't take them, and any row drawn outside a pane.
 */
export const NO_EFFECTS: Effects = {
  // eslint-disable-next-line unicorn/no-useless-undefined -- none, for every row
  choiceFor: () => undefined,
  // eslint-disable-next-line unicorn/no-useless-undefined -- none known
  effectOf: () => undefined,
  // eslint-disable-next-line unicorn/no-useless-undefined -- none sent
  send: () => undefined,
  waitingOf: () => false,
  // eslint-disable-next-line unicorn/no-useless-undefined -- each row keeps its own
  openAt: () => undefined,
  setOpenAt: () => {},
  focusing: { current: new Map() },
}

const EffectsContext = createContext<Effects>(NO_EFFECTS)

/** What the rows inside offer of the character's own effects. */
export function Effecting({
  value,
  children,
}: Readonly<{ value: Effects; children: ReactNode }>) {
  return <EffectsContext value={value}>{children}</EffectsContext>
}

/** The last change of an effect's sent from here: its local id, and what it asked. */
type Sent = { id: string; op: EffectOp }

/**
 * Whether the sheet says what the game made of a change: the effect gone once deleted, else off or
 * on as the game says, or as asked where it says nothing.
 */
function agrees(
  row: SheetEffect | undefined,
  op: EffectOp,
  change: EffectChange | undefined,
): boolean {
  if (change?.deleted ?? op === 'delete') return row === undefined
  const disabled = change?.disabled ?? op === 'disable'
  return row !== undefined && row.disabled === disabled
}

/** Gives a row's own control focus, where focus was on that row or lost, and never elsewhere. */
function focusIfLost(target: HTMLElement | null | undefined): void {
  if (!target?.isConnected) return
  const active = document.activeElement
  const row = target.closest('li')
  if (!active || active === document.body || row?.contains(active)) {
    target.focus()
  }
}

/** What takes focus for a row: what opens it, else the row itself where it takes focus. */
function rowControl(row: Element | undefined): HTMLElement | undefined {
  if (!row?.isConnected) return undefined
  return (
    row.querySelector<HTMLElement>('summary') ??
    row.querySelector<HTMLElement>('[tabindex="0"]') ??
    undefined
  )
}

/**
 * What a pane offers of its character's own effects, from module 0.39.0: on each, what its `ops`
 * say, while the pane offers them; none where it doesn't. One sent waits while it's on its way,
 * and once made until the sheet says what the game made of it, for up to `EFFECT_SETTLE`; never
 * once it failed or was refused, so that it can be tried again. It keeps each row's open state, so
 * that one moved to another section opens again there, and gives focus where it goes once the
 * sheet agrees: to the moved row, or after a delete to the row beside it.
 * @param on - Whether the pane offers them: its seat's player may, and it's no companion's.
 * @param character - The character's name, which Delete's dialog says it's removed from.
 * @param send - Sends one, and logs it among the rolls, returning its local id: from 0.42.1, at a
 *   time given, where a roll made it, so that its line is kept beneath that roll.
 */
export function useEffectControls({
  on,
  character,
  effects,
  states,
  send,
}: Readonly<{
  on: boolean
  character: string
  effects: SheetEffectSection[]
  states: ReadonlyMap<string, TableRollState>
  send: (effect: SheetEffect, op: EffectOp, at?: number) => string
}>): Effects {
  const [sent, setSent] = useState<ReadonlyMap<string, Sent>>(() => new Map())
  // The local ids of those sent long enough ago that the sheet should have come.
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set())
  const [opened, setOpened] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  )
  const focusing = useRef(new Map<string, Focusing>())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const running = timers.current
    return () => {
      for (const timer of running) clearTimeout(timer)
    }
  }, [])
  const index = useMemo(
    () =>
      new Map(
        effects.flatMap(section =>
          section.effects.map(effect => [effect.id, effect] as const),
        ),
      ),
    [effects],
  )

  const waitingOf = useCallback(
    (effect: string, id: string, op: EffectOp): boolean => {
      const state = states.get(id)
      // Sent, its way not yet heard of: as on its way, for as long as the sheet might take.
      if (!state) return !settled.has(id)
      if (state.status === 'sending' || state.status === 'rolling') return true
      return (
        state.status === 'done' &&
        !settled.has(id) &&
        !agrees(index.get(effect), op, state.changed)
      )
    },
    [states, settled, index],
  )
  const waitingFor = useCallback(
    (effect: string): boolean => {
      const last = sent.get(effect)
      return !!last && waitingOf(effect, last.id, last.op)
    },
    [sent, waitingOf],
  )

  const sendChange = useCallback(
    (effect: SheetEffect, op: EffectOp, at?: number): string | undefined => {
      if (!on || !effect.ops?.includes(op) || waitingFor(effect.id)) return
      // A row's change logged as it's sent, as ever; one a roll made, at the time given.
      const id = at === undefined ? send(effect, op) : send(effect, op, at)
      setSent(held => new Map(held).set(effect.id, { id, op }))
      const timer = setTimeout(() => {
        timers.current.delete(timer)
        setSettled(held => new Set(held).add(id))
      }, EFFECT_SETTLE)
      timers.current.add(timer)
      return id
    },
    [on, waitingFor, send],
  )

  const choiceFor = useCallback(
    (effect: SheetEffect): EffectChoice | undefined => {
      if (!on) return undefined
      const ops = EFFECT_OPS.filter(op => effect.ops?.includes(op))
      if (ops.length === 0) return undefined
      const waiting = waitingFor(effect.id)
      return {
        ops,
        waiting,
        ...(waiting && { pending: sent.get(effect.id)?.op }),
        choose: op => {
          sendChange(effect, op)
        },
      }
    },
    [on, waitingFor, sent, sendChange],
  )

  const effectOf = useCallback((id: string) => index.get(id), [index])

  const openAt = useCallback(
    (key: string) => opened.get(key) === true,
    [opened],
  )
  const setOpenAt = useCallback((key: string, open: boolean) => {
    setOpened(held =>
      (held.get(key) === true) === open ? held : new Map(held).set(key, open),
    )
  }, [])

  // An effect deleted from a row, once it has gone from the sheet: focus, lost with its row, goes
  // to the row beside it, else the tab's panel; where the row is still there, it gives it itself.
  useLayoutEffect(() => {
    for (const [key, { effect, op, id, after }] of focusing.current) {
      if (index.has(effect) || waitingOf(effect, id, op)) continue
      focusing.current.delete(key)
      if (op !== 'delete') continue
      const active = document.activeElement
      if (active && active !== document.body) continue
      const [next, previous, panel] = after
      const target =
        rowControl(next) ??
        rowControl(previous) ??
        (panel?.isConnected ? (panel as HTMLElement) : undefined)
      target?.focus()
    }
  })

  return useMemo(
    () => ({
      character,
      choiceFor,
      effectOf,
      send: sendChange,
      waitingOf,
      openAt,
      setOpenAt,
      focusing,
    }),
    [character, choiceFor, effectOf, sendChange, waitingOf, openAt, setOpenAt],
  )
}

/**
 * What became of an effect a die offered spent, from module 0.42.1, such as the Inspired that
 * Bardic Inspiration's die used up: gone from the sheet; or its removal on its way, or about to
 * be, waiting on another change of it; or whether the player may remove it at all, which they
 * can't where the campaign doesn't let them, at a companion's pane, or where its source isn't the
 * party's.
 */
export type Spent = { gone: boolean; removing: boolean; removable: boolean }

/** What became of each effect a die offered spent, by the sheet's id for it (module 0.42.1). */
export function useSpent(): (id: string) => Spent {
  const effects = use(EffectsContext)
  return (id: string) => {
    const effect = effects.effectOf(id)
    if (!effect) return { gone: true, removing: false, removable: false }
    const choice = effects.choiceFor(effect)
    const removable = choice?.ops.includes('delete') === true
    return { gone: false, removing: removable && !!choice?.waiting, removable }
  }
}

/**
 * A row of one of the character's own effects, from module 0.39.0: what may be done to it, its
 * open state where the pane keeps it, and its row, which takes focus once a change chosen on it is
 * on the sheet, where focus was on the row or lost with the control pressed.
 * @param among - Where it's drawn, as an effect may be on the Effects tab and among the favorites
 *   at once, each row with its own open state.
 */
export function useEffectChoice(
  effect: SheetEffect,
  among: 'effects' | 'favorites' = 'effects',
): {
  choice?: EffectChoice
  character?: string
  open?: boolean
  setOpen?: (open: boolean) => void
  row: RefObject<HTMLElement | null>
} {
  const effects = use(EffectsContext)
  const key = `${among}:${effect.id}`
  const row = useRef<HTMLElement>(null)
  const given = effects.choiceFor(effect)
  const choice: EffectChoice | undefined = given && {
    ...given,
    choose: op => {
      const id = effects.send(effect, op)
      if (id === undefined) return
      // Where focus goes once the sheet agrees: this row, wherever it's drawn by then; or, once
      // it's deleted, the row beside it.
      const at = row.current?.closest('li')
      effects.focusing.current.set(key, {
        effect: effect.id,
        op,
        id,
        after:
          op === 'delete'
            ? [
                at?.nextElementSibling ?? undefined,
                at?.previousElementSibling ?? undefined,
                at?.closest('[role="tabpanel"]') ?? undefined,
              ]
            : [],
      })
    },
  }
  useLayoutEffect(() => {
    const focusing = effects.focusing.current
    const held = focusing.get(key)
    if (!held || effects.waitingOf(held.effect, held.id, held.op)) return
    focusing.delete(key)
    focusIfLost(row.current)
  })
  const open = effects.openAt(key)
  return {
    choice,
    character: effects.character,
    open,
    setOpen:
      open === undefined
        ? undefined
        : (next: boolean) => effects.setOpenAt(key, next),
    row,
  }
}

/**
 * The buttons inside one of the character's own effects' opened row (module 0.39.0), never on the
 * row itself, which opens it: Turn off or Turn on, then Delete…, which asks first. Each is named
 * with the effect; while a change of it waits, each is disabled, the one pressed turning.
 */
export function EffectButtons({
  name,
  choice,
  onDelete,
}: Readonly<{
  /** The effect's name, which each button is named with. */
  name: string
  choice: EffectChoice
  onDelete: () => void
}>) {
  return (
    <div className='flex flex-wrap gap-2'>
      {choice.ops.map(op => (
        <button
          key={op}
          type='button'
          aria-label={effectControlName(op, name)}
          aria-haspopup={op === 'delete' ? 'dialog' : undefined}
          disabled={choice.waiting}
          onClick={() => (op === 'delete' ? onDelete() : choice.choose(op))}
          className={clsx(
            'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border px-2 text-xs font-semibold transition-colors disabled:opacity-60',
            op === 'delete'
              ? 'text-danger hover:border-danger/50 hover:bg-danger/5'
              : 'hover:bg-primary/5',
          )}
        >
          {choice.pending === op && (
            <LoaderCircle
              aria-hidden
              className='size-3.5 shrink-0 motion-safe:animate-spin'
            />
          )}
          {EFFECT_WORDS[op].button}
        </button>
      ))}
    </div>
  )
}
