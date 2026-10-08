'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStoredChoice } from '@/hooks/use-stored'
import { changes, type DamageModifiers } from '@/utils/damage-modifiers'
import { parseExtraTerms, type ExtraTerm } from '@/utils/roll-modifiers'
import type {
  LocalCheck,
  LocalDamage,
  LocalUse,
  SheetDamageRoll,
  SheetRoll,
} from '@/hooks/use-sheet-roller'
import type {
  RolledDice,
  RollFeature,
  RollKind,
  RollRequestInput,
  RollRequestView,
  RollSource,
  RollStatus,
  UseSource,
} from '@/types/roll'
import type { DamagePreview } from '@/types/sending-stone'

/** How often to ask after a roll sent to the Gamemaster's game, in milliseconds. */
export const CHECK_EVERY = 1000

/**
 * How long to ask after it, in milliseconds: past the time the game has to fetch it and then to
 * answer, so that the app has said where it stands by then.
 */
export const FOLLOW_FOR = 110_000

/**
 * How long to go on asking after a roll the game took too long to make, in milliseconds: an
 * attack can wait on the Gamemaster for up to five minutes, then be made after all.
 */
export const LATE_FOLLOW = 330_000

/** Where this browser keeps whether to send the player's rolls to the table. */
export const SEND_KEY = 'sending-stone:send-rolls'

const SEND_CHOICES = ['on', 'off'] as const

/** An attack's or a use's item and activity, by which its damage is found. */
export type AttackSource = { item: string; activity: string }

/**
 * A roll's way to the Gamemaster's game, as its player is told: as the app has it, or refused,
 * when the app didn't take it for the game at all, saying why. An attack's or a use's also keeps
 * its id at the table and what it was made with, so that its damage can be rolled there too, once.
 */
export type TableRollState = Omit<RollRequestView, 'id' | 'status'> & {
  status: RollStatus | 'refused'
  /** Its id at the table, once the app has taken it. */
  requestId?: string
  /** For an attack or a use, its item and activity. */
  source?: AttackSource
  /** For a use, what was used, such as "Fireball", which its damage is named after. */
  name?: string
  /** For a use, how the player chose to change the damage that follows it. */
  modifiers?: DamageModifiers
  /** For an attack or a use, whether its damage has been sent. */
  damaged?: boolean
  /** For a saving throw the game asked for, the prompt it answers. */
  prompt?: string
}

/** An attack or a use made at the table whose damage is still to roll there. */
export type DueDamage = {
  /** The attack's or use's id at the table. */
  use: string
  damage: DamagePreview
  /** How the player chose to change it as they used it, if they did. */
  modifiers?: DamageModifiers
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
 * Sends the rolls the player makes to the Gamemaster's game, to be made there with the same dice,
 * when the game takes them and the player hasn't turned sending off on this device; and follows
 * each until the game has made it. An attack the game made can then have its damage rolled there.
 * @param characterId - The player's character.
 * @param kinds - The rolls the game takes now.
 * @param features - What else the game does with them, such as take damage the player changed.
 * @returns `send` and `sendDamage`, to call as a roll's dice are thrown; each roll's way, by its
 * id; and which attacks wait for their damage.
 */
export function useTableRolls(
  characterId: string,
  kinds: readonly RollKind[] = [],
  features: readonly RollFeature[] = [],
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

  /** Send a roll to the game, and follow it, keeping its way under the local roll's id. */
  const start = useCallback(
    (
      localId: string,
      input: RollRequestInput,
      kept: Partial<TableRollState>,
    ) => {
      const controller = new AbortController()
      running.current.add(controller)
      const update = (state: TableRollState) => {
        if (!controller.signal.aborted) {
          setStates(held => new Map(held).set(localId, { ...kept, ...state }))
        }
      }
      update({ status: 'sending' })
      void follow(
        latest.current.characterId,
        input,
        controller.signal,
        update,
        id => {
          kept = { ...kept, requestId: id }
        },
      ).finally(() => running.current.delete(controller))
    },
    [],
  )

  const send = useCallback(
    (roll: SheetRoll, check: LocalCheck) => {
      const { source } = roll
      const { kinds, on } = latest.current
      if (!on || !source || !kinds.includes(source.kind)) return
      let kept: Partial<TableRollState> = {}
      if (source.kind === 'attack') {
        kept = { source: { item: source.item, activity: source.activity } }
      } else if (source.kind === 'save' && source.prompt) {
        kept = { prompt: source.prompt }
      }
      start(check.id, toRollRequest(roll, source, check), kept)
    },
    [start],
  )

  const sendDamage = useCallback(
    (roll: SheetDamageRoll, damage: LocalDamage) => {
      const { use, types, modifiers } = roll
      const { kinds, on } = latest.current
      if (!on || !use || !kinds.includes('damage')) return
      // Its attack's or use's damage is on its way: it isn't offered again.
      setStates(held => {
        const next = new Map(held)
        for (const [id, state] of next) {
          if (state.requestId === use) next.set(id, { ...state, damaged: true })
        }
        return next
      })
      start(
        damage.id,
        {
          kind: 'damage',
          use,
          mode: 0,
          explicit: false,
          extras: [],
          dice: damageDice(roll, damage),
          ...(types?.some(type => type !== null) && { types }),
          ...(modifiers && changes(modifiers) && { modifiers }),
        },
        {},
      )
    },
    [start],
  )

  const sendUse = useCallback(
    (used: LocalUse, use: UseSource, modifiers?: DamageModifiers) => {
      const { kinds, on } = latest.current
      if (!on || !kinds.includes('use')) return
      const { item, activity, targets } = use
      start(
        used.id,
        {
          kind: 'use',
          item,
          activity,
          targets,
          // eslint-disable-next-line unicorn/no-null -- the protocol's for the game's own slot
          slot: use.slot ?? null,
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
        {
          source: { item, activity },
          name: used.label,
          ...(modifiers && changes(modifiers) && { modifiers }),
        },
      )
    },
    [start],
  )

  const setSending = useCallback(
    (next: boolean) => choose(next ? 'on' : 'off'),
    [choose],
  )
  return {
    send,
    sendDamage,
    sendUse,
    states,
    /** Whether the game takes any of the player's rolls now. */
    available: kinds.length > 0,
    /** Whether the player sends their rolls from this device. */
    sending: on,
    setSending,
    /** Whether the game takes this kind of roll from this device now. */
    takes: (kind: RollKind) => on && kinds.includes(kind),
    /** Whether the game takes damage the player changed from this device now. */
    modifies: on && kinds.includes('damage') && features.includes('modifiers'),
    /**
     * The saves the game asked for that the player has answered from this page, on their way to
     * the game or made there: not to be answered again.
     */
    answering: answeringOf(states),
    /** The attack or use at the table with this id, if its damage is still to roll there. */
    dueDamage: (use: string) => dueOf(states, state => state.requestId === use),
    /**
     * The latest attack or use at the table made with this item and activity, if its damage is
     * due.
     */
    dueFor: (source: AttackSource) =>
      dueOf(
        states,
        state =>
          state.source?.item === source.item &&
          state.source.activity === source.activity,
      ),
  }
}

/** The prompts answered by rolls on their way to the game, or made there. */
function answeringOf(
  states: ReadonlyMap<string, TableRollState>,
): ReadonlySet<string> {
  const answering = new Set<string>()
  for (const { prompt, status } of states.values()) {
    if (prompt && ['sending', 'rolling', 'done'].includes(status)) {
      answering.add(prompt)
    }
  }
  return answering
}

/** The latest of the attacks that pass the test whose damage is still to roll at the table. */
function dueOf(
  states: ReadonlyMap<string, TableRollState>,
  test: (state: TableRollState) => boolean,
): DueDamage | undefined {
  const due = [...states.values()].findLast(
    state =>
      test(state) &&
      state.status === 'done' &&
      !!state.damage &&
      !state.damaged &&
      !!state.requestId,
  )
  return due?.requestId && due.damage
    ? {
        use: due.requestId,
        damage: due.damage,
        ...(due.modifiers && { modifiers: due.modifiers }),
      }
    : undefined
}

/** Send a roll to the game, then ask after it until it's made, or given up on. */
async function follow(
  characterId: string,
  input: RollRequestInput,
  signal: AbortSignal,
  update: (state: TableRollState) => void,
  taken: (id: string) => void,
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
    taken(id)
  } catch {
    update({ status: 'refused', reason: 'network' })
    return
  }

  let until = Date.now() + FOLLOW_FOR
  let late = false
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
        update({ ...view, requestId: id })
        // A roll that took too long may still be made, once the Gamemaster answers.
        if (view.status === 'failed' && view.reason === 'timeout') {
          if (!late) until = Date.now() + LATE_FOLLOW
          late = true
        } else if (SETTLED.has(view.status)) {
          return
        }
      }
    } catch {
      // Asked again next time.
    }
  }
  if (!late) update({ status: 'lost', requestId: id })
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
    ...(source.kind === 'save' && source.prompt && { prompt: source.prompt }),
    ...(source.kind === 'attack' && {
      item: source.item,
      activity: source.activity,
      // eslint-disable-next-line unicorn/no-null -- the protocol's for no target
      target: source.target ?? null,
      ...(source.slot && { slot: source.slot }),
      ...(source.ammunition && { ammunition: source.ammunition }),
      ...(source.attackMode && { attackMode: source.attackMode }),
    }),
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

/** Damage's dice as thrown, part by part and term by term, for the game to roll them too. */
function damageDice(roll: SheetDamageRoll, damage: LocalDamage): RolledDice[] {
  return roll.parts.flatMap((part, index) =>
    part.terms.flatMap((term, at) =>
      'sides' in term
        ? [
            {
              faces: term.sides,
              results: damage.parts[index]?.terms[at]?.values ?? [],
            },
          ]
        : [],
    ),
  )
}

/**
 * An attack's or a use's damage or healing, to roll as the game said it will: each of its rolls a
 * part, with its dice as the game will throw them, a critical hit's already doubled, and its
 * numbers where the app can read them, as the kind of damage chosen, if any, and changed as the
 * player chose. Damage the game can't say beforehand has no dice here: the game rolls them.
 * @param label - What the attack or use was made with, such as "Longsword".
 * @param type - The kind of damage chosen, such as "fire", for each roll that offers it.
 * @param modifiers - How the player changes it now; else as they chose as they used it.
 */
export function damageRollOf(
  label: string,
  { use, damage, modifiers: chosen }: DueDamage,
  type?: string,
  modifiers: DamageModifiers | undefined = chosen,
): SheetDamageRoll {
  const healing = damage.healing === true
  const types = type ? typesFor(damage, type) : undefined
  return {
    label: `${label} ${healing ? 'healing' : 'damage'}`,
    critical: damage.critical,
    healing,
    exact: true,
    use,
    ...(types && { types }),
    ...(modifiers && changes(modifiers) && { modifiers }),
    perDie: damage.rolls[0]?.perDie ?? 1,
    parts: damage.rolls.map((roll, index) => ({
      type: chosenLabel(roll, types?.[index]) ?? roll.type,
      terms: damage.plannable ? termsOf(roll) : [],
    })),
  }
}

/** The kinds of damage among which a roll of damage lets its roller choose, if any. */
export function choicesOf(damage: DamagePreview) {
  return damage.rolls.find(roll => (roll.types?.length ?? 0) > 1)?.types ?? []
}

/** The kind chosen for each of damage's rolls: this one, for each roll that offers it. */
function typesFor(damage: DamagePreview, type: string): (string | null)[] {
  return damage.rolls.map(roll =>
    // eslint-disable-next-line unicorn/no-null -- the protocol's for the game's own choice
    roll.types?.some(({ key }) => key === type) ? type : null,
  )
}

/** A kind of damage chosen, as the game labels it. */
function chosenLabel(
  roll: DamagePreview['rolls'][number],
  type: string | null | undefined,
): string | undefined {
  return roll.types?.find(({ key }) => key === type)?.label
}

/**
 * A roll's terms, as its formula has them, when they throw the dice the game said; otherwise its
 * dice alone.
 */
function termsOf(roll: DamagePreview['rolls'][number]): ExtraTerm[] {
  const dice = roll.dice.map(({ faces, number }) => ({
    sign: 1 as const,
    count: number,
    sides: faces as Extract<ExtraTerm, { sides: number }>['sides'],
  }))
  const parsed = parseExtraTerms(roll.formula)
  if (!parsed.ok) return dice
  const thrown = parsed.terms.filter(term => 'sides' in term)
  const same =
    thrown.length === dice.length &&
    thrown.every(
      (term, index) =>
        term.sign === 1 &&
        term.count === dice[index].count &&
        term.sides === dice[index].sides,
    )
  return same ? parsed.terms : dice
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
