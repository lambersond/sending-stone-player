import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from 'react'
import { EFFECT_SETTLE, EFFECT_OPS } from '@/constants/sending-stone'
import { onItsWay } from '@/utils/lifecycle'
import type { Effects, Focusing, EffectChoice } from './types'
import type { TableRollState } from '@/types/roll'
import type {
  EffectOp,
  SheetEffect,
  EffectChange,
  SheetEffectSection,
} from '@/types/sending-stone'

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
      if (onItsWay(state)) return true
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
