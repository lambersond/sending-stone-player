'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStoredChoice } from '@/hooks/use-stored'
import type { LocalCheck, SheetRoll } from '@/hooks/use-sheet-roller'
import type {
  RollKind,
  RollRequestInput,
  RollRequestView,
  RollSource,
  RollStatus,
} from '@/types/roll'

/** How often to ask after a roll sent to the Gamemaster's game, in milliseconds. */
export const CHECK_EVERY = 1000

/**
 * How long to ask after it, in milliseconds: past the time the game has to fetch it and then to
 * answer, so that the app has said where it stands by then.
 */
export const FOLLOW_FOR = 110_000

/** Where this browser keeps whether to send the player's rolls to the table. */
export const SEND_KEY = 'sending-stone:send-rolls'

const SEND_CHOICES = ['on', 'off'] as const

/**
 * A roll's way to the Gamemaster's game, as its player is told: as the app has it, or refused,
 * when the app didn't take it for the game at all, saying why.
 */
export type TableRollState = Omit<RollRequestView, 'id' | 'status'> & {
  status: RollStatus | 'refused'
}

/** Where a roll's way to the game ends. */
const SETTLED = new Set<TableRollState['status']>([
  'done',
  'failed',
  'expired',
  'lost',
  'refused',
])

/**
 * Sends the checks and saves the player rolls to the Gamemaster's game, to be made there with the
 * same dice, when the game takes them and the player hasn't turned sending off on this device; and
 * follows each until the game has made it.
 * @param characterId - The player's character.
 * @param kinds - The rolls the game takes now.
 * @returns `send`, to call as a roll's dice are thrown; and each roll's way, by its id.
 */
export function useTableRolls(
  characterId: string,
  kinds: readonly RollKind[] = [],
) {
  const [states, setStates] = useState<ReadonlyMap<string, TableRollState>>(
    () => new Map(),
  )
  const [choice, choose] = useStoredChoice(SEND_KEY, SEND_CHOICES, 'on')
  const on = choice === 'on'
  // As the latest render has them, for `send` to stay the same function.
  const latest = useRef({ characterId, kinds, on })
  useEffect(() => {
    latest.current = { characterId, kinds, on }
  })
  const running = useRef(new Set<AbortController>())
  useEffect(() => {
    const controllers = running.current
    return () => {
      for (const controller of controllers) controller.abort()
    }
  }, [])

  const send = useCallback((roll: SheetRoll, check: LocalCheck) => {
    const { source } = roll
    const { characterId, kinds, on } = latest.current
    if (!on || !source || !kinds.includes(source.kind)) return
    const controller = new AbortController()
    running.current.add(controller)
    const update = (state: TableRollState) => {
      if (!controller.signal.aborted) {
        setStates(held => new Map(held).set(check.id, state))
      }
    }
    update({ status: 'sending' })
    void follow(
      characterId,
      toRollRequest(roll, source, check),
      controller.signal,
      update,
    ).finally(() => running.current.delete(controller))
  }, [])

  const setSending = useCallback(
    (next: boolean) => choose(next ? 'on' : 'off'),
    [choose],
  )
  return {
    send,
    states,
    /** Whether the game takes any of the player's rolls now. */
    available: kinds.length > 0,
    /** Whether the player sends their rolls from this device. */
    sending: on,
    setSending,
  }
}

/** Send a roll to the game, then ask after it until it's made, or given up on. */
async function follow(
  characterId: string,
  input: RollRequestInput,
  signal: AbortSignal,
  update: (state: TableRollState) => void,
) {
  let id: string
  try {
    const response = await fetch(`/api/characters/${characterId}/rolls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    })
    if (response.status !== 202) {
      update({ status: 'refused', reason: await refusal(response) })
      return
    }
    const created = (await response.json()) as { id: string }
    id = created.id
  } catch {
    update({ status: 'refused', reason: 'network' })
    return
  }

  const until = Date.now() + FOLLOW_FOR
  while (Date.now() < until) {
    await pause(CHECK_EVERY, signal)
    if (signal.aborted) return
    try {
      const response = await fetch(
        `/api/characters/${characterId}/rolls/${id}`,
        { cache: 'no-store', signal },
      )
      // A roll this page can't see any more, such as once signed out, is given up on.
      if (response.status === 401 || response.status === 404) break
      if (response.ok) {
        const view = (await response.json()) as RollRequestView
        update(view)
        if (SETTLED.has(view.status)) return
      }
    } catch {
      // Asked again next time.
    }
  }
  update({ status: 'lost' })
}

/** Why the app didn't take a roll, as it says. */
async function refusal(response: Response): Promise<string> {
  if (![409, 422, 429].includes(response.status)) return 'error'
  try {
    const { reason } = (await response.json()) as { reason?: unknown }
    return typeof reason === 'string' ? reason : 'error'
  } catch {
    return 'error'
  }
}

/**
 * A roll as the game is asked to make it: what it is, how it was rolled, and every die thrown,
 * the d20s first, then the dice of each term the player added, in order.
 */
export function toRollRequest(
  roll: SheetRoll,
  source: RollSource,
  check: LocalCheck,
): RollRequestInput {
  const extras = roll.extras ?? []
  return {
    kind: source.kind,
    ...('key' in source && { key: source.key }),
    ...('combatId' in source && { combatId: source.combatId }),
    mode: modeOf(check.advantage),
    explicit: roll.explicit === true,
    extras,
    dice: [
      { faces: 20, results: check.d20s },
      ...extras.flatMap((term, index) =>
        'sides' in term
          ? [{ faces: term.sides, results: check.extras[index].values }]
          : [],
      ),
    ],
  }
}

function modeOf(advantage: LocalCheck['advantage']): -1 | 0 | 1 {
  if (advantage === 'adv') return 1
  if (advantage === 'dis') return -1
  return 0
}

/** Wait this long, or until given up on. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}
