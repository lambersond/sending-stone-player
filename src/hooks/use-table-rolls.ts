'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MAX_ROLL_LABEL,
  type EffectOp,
  type WildShapeOp,
} from '@/constants/sending-stone'
import { useStoredChoice } from '@/hooks/use-stored'
import { useTableApi, useTableRole } from '@/hooks/use-table-api'
import {
  changedAt,
  changes,
  marksTaken,
  signedDice,
  takenModifiers,
  type DamageModifiers,
} from '@/utils/damage-modifiers'
import { formulaTerms } from '@/utils/formulas'
import { moveLabel } from '@/utils/move-words'
import type {
  LocalAsk,
  LocalCheck,
  LocalDamage,
  LocalFormula,
  LocalGmRoll,
  LocalMove,
  LocalRoll,
  LocalUse,
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/hooks/use-sheet-roller'
import type {
  ActivityRef,
  EndEnchantmentSource,
  FavoriteInput,
  FormulaSource,
  GmRollView,
  InspirationSource,
  RemoveInput,
  RolledDice,
  RollFeature,
  RollKind,
  RollRequestInput,
  RollRequestView,
  RollSource,
  RollStatus,
  SpendSource,
  TextLink,
  TransferInput,
  UseSource,
  WildShapeInput,
} from '@/types/roll'
import type {
  AloneSpend,
  BeastEntry,
  DamagePreview,
  EffectChange,
  SheetEffect,
  WildShapeOutcome,
} from '@/types/sending-stone'
import type { TableCombat } from '@/types/table'
import type { ExtraTerm } from '@/utils/roll-modifiers'

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

/**
 * Of rolls sent one after another, as hit dice spent at once to a game before module 0.20.0, how
 * long to wait before sending one again that the app turned away as one too many at once, in
 * milliseconds; and how long to go on sending it: past the minute over which the app counts a
 * character's rolls.
 */
export const BUSY_WAIT = 5000
export const BUSY_FOR = 65_000

/** Where this browser keeps whether to send the player's rolls to the table. */
export const SEND_KEY = 'sending-stone:send-rolls'

/** And whether to send the Gamemaster's, at a character's sheet (#156): a switch of its own. */
export const GM_SEND_KEY = `${SEND_KEY}:gm`

/**
 * Where this browser keeps whether damage the player rolls goes to the table on its own, with no
 * attack or use made there (module 0.36.0): off until they turn it on; and the Gamemaster's, at a
 * character's sheet, a switch of its own.
 */
export const ALONE_KEY = 'sending-stone:send-damage'
export const GM_ALONE_KEY = `${ALONE_KEY}:gm`

/** What each of those switches is: on or off. End Turn reads Send's too (module 0.36.0). */
export const SEND_CHOICES = ['on', 'off'] as const

/**
 * A spent recharge rolled (module 0.36.0): what it's called, and the uses it recharges, as the
 * sheet names them: an item's own, or one of its activities'.
 */
export type RechargeRoll = {
  label: string
  counter: { item: string; activity?: string }
}

/** An attack's or a use's item and activity, by which its damage is found. */
export type AttackSource = { item: string; activity: string }

/**
 * A roll's way to the Gamemaster's game, as its player is told: as the app has it, or refused,
 * when the app didn't take it for the game at all, saying why. An attack's or a use's also keeps
 * its id at the table and what it was made with, so that its damage can be rolled there too, once.
 */
export type TableRollState = Omit<
  RollRequestView,
  'id' | 'status' | 'effect' | 'wildShape' | 'alone'
> & {
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
  /** For an area attack, the names of the combatants it was made at, by their ids. */
  targetNames?: Record<string, string>
  /**
   * For an attack or a use of a spell an item casts, which is cast at a level the item offers,
   * rather than with a spell slot: a level it doesn't offer is refused as a slot is.
   */
  itemCast?: boolean
  /**
   * For hit dice spent at once sent as one, as from module 0.20.0, which are refused for want of
   * dice where there aren't as many of a size left as are spent, not only where there are none.
   */
  hitDice?: boolean
  /**
   * For rolls sent one after another as one, as hit dice spent at once are to a game before module
   * 0.20.0, a request a die: how many there are, and how many of them the game has made. From
   * 0.20.0, sent as one, the same, once the game stopped part way through them.
   */
  together?: { count: number; made: number }
  /**
   * For a roll of a d20 the Gamemaster made as the character (#156), whether the game says it came
   * up a critical or a fumble, as there are no dice of it here to say.
   */
  d20?: GmRollView['d20']
  /**
   * For damage the Gamemaster rolled as the character (#156), that the game says it's a critical
   * hit's, as there are no dice of it here to say.
   */
  critical?: GmRollView['critical']
  /**
   * For a move of items and coins, from module 0.31.0, what moved and between whom; and for a
   * removal, from module 0.33.0, what was removed and from whom.
   */
  move?: LocalMove
  /**
   * For a use, its damage waits for the player to roll it, as one with a choice of kinds does,
   * while they type in their own dice.
   */
  offer?: true
  /** Damage or healing sent on its own (module 0.36.0). */
  alone?: true
  /**
   * Damage on its own that asked to spend what its use would, from module 0.41.0 (round 0.41.0
   * §2.10): its tray says what was spent, once the game says.
   */
  consumes?: true
  /**
   * What the game spent of it, once made (the view's `alone.spent`), none where it spent nothing;
   * kept apart from the hit dice a request spent, `spent`.
   */
  aloneSpent?: AloneSpend[]
  /** That concentration began as it was spent (the view's `alone.concentrating`). */
  concentrating?: true
  /** A recharge rolled (module 0.36.0). */
  recharge?: true
  /** A favorite added or removed (module 0.37.0). */
  favorite?: 'add' | 'remove'
  /** One of the character's own effects turned off, on or deleted (module 0.39.0): which. */
  effect?: EffectOp
  /**
   * What became of that effect, once made, as the game says (the view's `effect`): kept apart from
   * what was asked, which the line is worded by.
   */
  changed?: EffectChange
  /** Wild Shape from here (module 0.40.0): which op was asked. */
  wildShape?: WildShapeOp
  /**
   * What the game made of it, once made (the view's `wildShape`): the form taken or left, or the
   * Beast learned, kept apart from what was asked, as an effect's is.
   */
  wildShaped?: WildShapeOutcome
}

/**
 * The Beasts the druid may learn, as the game lists them (module 0.40.0): those it sent, whether
 * there are more than it sent, and the rules they were chosen by; or why it didn't list them.
 */
export type WildShapeForms =
  | {
      forms: BeastEntry[]
      more: boolean
      limits: { count: number; cr: number; fly: boolean }
    }
  | { reason: string }

/** An attack or a use made at the table whose damage is still to roll there. */
export type DueDamage = {
  /** The attack's or use's id at the table. */
  use: string
  damage: DamagePreview
  /** How the player chose to change it as they used it, if they did. */
  modifiers?: DamageModifiers
}

/** Where a roll's way to the game ends. */
export const SETTLED = new Set<TableRollState['status']>([
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
 * @param characterId - The player's character, or for the Gamemaster's seat (#156) its key; the
 *   seat's own API, where one is provided, is what the rolls go through.
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
  const api = useTableApi(characterId)
  const gm = useTableRole() === 'gm'
  const [choice, choose] = useStoredChoice(
    gm ? GM_SEND_KEY : SEND_KEY,
    SEND_CHOICES,
    'on',
  )
  const on = choice === 'on'
  // Damage on its own, from module 0.36.0: off until the player turns it on, on this device.
  const [alone, chooseAlone] = useStoredChoice(
    gm ? GM_ALONE_KEY : ALONE_KEY,
    SEND_CHOICES,
    'off',
  )
  const sendsAlone = on && alone === 'on' && kinds.includes('itemDamage')
  // As the latest render has them, for `send` to stay the same function.
  const latest = useRef({ api, kinds, features, on, gm, sendsAlone })
  useEffect(() => {
    latest.current = { api, kinds, features, on, gm, sendsAlone }
  })
  const running = useRef(new Set<AbortController>())
  useEffect(() => {
    const controllers = running.current
    return () => {
      for (const controller of controllers) controller.abort()
    }
  }, [])

  /**
   * Send a roll to the game, and follow it, keeping its way under the local roll's id. The
   * Gamemaster's page (#156) says what it calls it, for the character's player to be shown it by.
   * @param label - What this page calls it, such as "Perception check".
   */
  const start = useCallback(
    (
      localId: string,
      sent: RollRequestInput,
      kept: Partial<TableRollState>,
      label: string,
    ) => {
      const input = latest.current.gm ? labelled(sent, label) : sent
      const controller = new AbortController()
      running.current.add(controller)
      const update = (state: TableRollState) => {
        if (controller.signal.aborted) return
        // Hit dice the game stopped spending part way, which it made some of, say how many.
        const partly =
          state.status === 'failed' && (state.spent?.made ?? 0) > 0
            ? { together: state.spent }
            : {}
        setStates(held =>
          new Map(held).set(localId, { ...kept, ...state, ...partly }),
        )
      }
      update({ status: 'sending' })
      void follow(latest.current.api, input, controller.signal, update, id => {
        kept = { ...kept, requestId: id }
      }).finally(() => running.current.delete(controller))
    },
    [],
  )

  /**
   * Send rolls to the game one after another, each once the game has made the one before it, and
   * follow them, keeping their way together under the local roll's id: as hit dice spent at once,
   * which a game before module 0.20.0 spends one a request, so that no more than one is on its way
   * at once. One the app turns away as one too many at once is sent again, with the same dice, a
   * moment later, for up to a minute: many dice spent at once may be more than a minute's rolls.
   * None is sent after one the game didn't make, nor once the page is left, which the player is
   * told as they're sent.
   */
  const startEach = useCallback(
    (localId: string, sent: RollRequestInput[], label: string) => {
      const inputs = latest.current.gm
        ? sent.map(input => labelled(input, label))
        : sent
      const controller = new AbortController()
      const { signal } = controller
      running.current.add(controller)
      const each: TableRollState[] = []
      const update = () => {
        if (!signal.aborted) {
          setStates(held =>
            new Map(held).set(localId, together(each, inputs.length)),
          )
        }
      }
      const send = async (index: number, input: RollRequestInput) => {
        const until = Date.now() + BUSY_FOR
        while (!signal.aborted) {
          each[index] = { status: 'sending' }
          update()
          // Turned away as one too many at once, it's still on its way while it may be sent again.
          let again = false
          await follow(
            latest.current.api,
            input,
            signal,
            state => {
              again = busy(state) && Date.now() < until
              if (again) return
              each[index] = state
              update()
            },
            () => {},
          )
          if (signal.aborted || !again) return
          await pause(BUSY_WAIT, signal)
        }
      }
      const run = async () => {
        for (const [index, input] of inputs.entries()) {
          await send(index, input)
          if (signal.aborted || each[index].status !== 'done') return
        }
      }
      void run().finally(() => running.current.delete(controller))
    },
    [],
  )

  /**
   * Whether a d20 roll from the sheet goes to the game from this device now: Send to the table on,
   * the game taking its kind, and a check an activity asks for only where the game makes it against
   * the activity, from module 0.21.0. Any other is the player's alone. As the latest render has it,
   * for what's asked of a roll as it's made, such as the dice its effects add, to stay the same.
   */
  const sends = useCallback((source?: RollSource): source is RollSource => {
    const { kinds, features, on } = latest.current
    if (!on || !source || !kinds.includes(source.kind)) return false
    return !activityCheck(source) || features.includes('activityChecks')
  }, [])

  const send = useCallback(
    (roll: SheetRoll, check: LocalCheck) => {
      const { source } = roll
      if (!sends(source)) return
      let kept: Partial<TableRollState> = {}
      if (source.kind === 'attack') {
        kept = {
          source: { item: source.item, activity: source.activity },
          ...(roll.targetNames && { targetNames: roll.targetNames }),
          ...(roll.itemCast && { itemCast: true }),
        }
      } else if ('prompt' in source && source.prompt) {
        kept = { prompt: source.prompt }
      }
      start(check.id, toRollRequest(roll, source, check), kept, roll.label)
    },
    [start, sends],
  )

  const sendDamage = useCallback(
    (roll: SheetDamageRoll, damage: LocalDamage) => {
      const { use, types, modifiers, text, alone } = roll
      const { kinds, features, on } = latest.current
      // An action's damage or healing on its own, from module 0.36.0, where the player sends it so:
      // no attack or use made, for the Gamemaster to apply from dnd5e's card. Otherwise, it's the
      // player's alone.
      if (alone) {
        if (!latest.current.sendsAlone) return
        // Its slot, attack mode and ammunition, and whether it spends what its use would, from
        // module 0.41.0, only to a game that takes them (round 0.41.0 §2.10).
        const choosing = features.includes('aloneChoices')
        const consume = choosing && alone.consume === true
        start(
          damage.id,
          {
            kind: 'itemDamage',
            item: alone.item,
            activity: alone.activity,
            ...(choosing && alone.slot && { slot: alone.slot }),
            ...(choosing &&
              alone.attackMode && { attackMode: alone.attackMode }),
            ...(choosing &&
              alone.ammunition && { ammunition: alone.ammunition }),
            ...(consume && { consume: true as const }),
            mode: 0,
            explicit: false,
            extras: [],
            dice: damageDice(roll, damage),
            ...(types?.some(type => type !== null) && { types }),
            ...(alone.critical && { critical: true as const }),
            ...(modifiers && changes(modifiers) && { modifiers }),
            ...(damage.typed && { typed: true as const }),
            ...(damage.typed &&
              damage.rerolls === 'kept' && { rerolls: 'kept' as const }),
          },
          // So that the tray words it as on its own, its kind not being in its state, and says
          // what it spent where it asked to.
          { alone: true, ...(consume && { consumes: true as const }) },
          roll.label,
        )
        return
      }
      // A description's damage or healing, which the game reads from its own copy of it: changed
      // as the player chose, and a critical hit's, as the world's rules make one, where one is
      // offered, with what it adds. One with its dice doubled here, not made so, or not offered
      // so, is the player's alone.
      if (text) {
        if (!on || !kinds.includes('textDamage')) return
        if (roll.critical && (!roll.criticalRule || !roll.criticalAdds)) return
        start(
          damage.id,
          {
            kind: 'textDamage',
            text: text.text,
            link: text.link,
            mode: 0,
            explicit: false,
            extras: [],
            dice: damageDice(roll, damage),
            ...(types?.some(type => type !== null) && { types }),
            ...(roll.critical && { critical: true as const }),
            ...(modifiers && changes(modifiers) && { modifiers }),
            ...(damage.typed && { typed: true as const }),
            ...(damage.typed &&
              damage.rerolls === 'kept' && { rerolls: 'kept' as const }),
          },
          {},
          roll.label,
        )
        return
      }
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
          ...(damage.typed && { typed: true as const }),
          // Its rerolls made at the table, as typed in, from module 0.42.0.
          ...(damage.typed &&
            damage.rerolls === 'kept' && { rerolls: 'kept' as const }),
        },
        {},
        roll.label,
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
          // At its user too, where the game makes it so.
          ...(use.self && { self: true as const }),
          // eslint-disable-next-line unicorn/no-null -- the protocol's for the game's own slot
          slot: use.slot ?? null,
          // How an enchant activity enchants, and what.
          ...(use.enchant && { enchant: use.enchant }),
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
        {
          source: { item, activity },
          name: used.label,
          ...(used.itemCast && { itemCast: true }),
          ...(modifiers && changes(modifiers) && { modifiers }),
        },
        used.label,
      )
    },
    [start],
  )

  const sendFormula = useCallback(
    (roll: SheetFormulaRoll, rolled: LocalFormula) => {
      const { source } = roll
      const { kinds, on } = latest.current
      if (!on || !source) return
      // Hit dice spent at once are one request, from module 0.20.0; before, a hit die each, as the
      // game spent a hit die a request, one after another, the largest first.
      if (source.kind === 'hitDice') {
        if (kinds.includes('hitDice')) {
          start(
            rolled.id,
            toHitDiceRequest(source, rolled),
            { hitDice: true },
            roll.label,
          )
        } else if (kinds.includes('hitDie')) {
          startEach(rolled.id, toHitDieRequests(source, rolled), roll.label)
        }
        return
      }
      if (!kinds.includes(source.kind)) return
      start(rolled.id, toFormulaRequest(roll, source, rolled), {}, roll.label)
    },
    [start, startEach],
  )

  /**
   * End an enchantment on one of the character's items, from module 0.21.0; kept, where it's ended
   * from an enchant activity's switch, with that activity, so that the switch follows it.
   */
  const sendEnd = useCallback(
    (
      ended: LocalUse,
      { item, effect }: Omit<EndEnchantmentSource, 'kind'>,
      source?: AttackSource,
    ) => {
      const { kinds, on } = latest.current
      if (!on || !kinds.includes('endEnchantment')) return
      start(
        ended.id,
        {
          kind: 'endEnchantment',
          enchantment: { item, effect },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
        source ? { source } : {},
        ended.label,
      )
    },
    [start],
  )

  /**
   * End a concentration of the character's, from module 0.29.0, by its effect's id: no roll, so
   * nothing to keep but its way.
   */
  const sendEndConcentration = useCallback(
    (ended: LocalUse, effect: string) => {
      const { kinds, on } = latest.current
      if (!on || !kinds.includes('endConcentration')) return
      start(
        ended.id,
        {
          kind: 'endConcentration',
          concentration: { effect },
          ...PLAIN,
        },
        {},
        ended.label,
      )
    },
    [start],
  )

  /** Spend charges of one of the character's counters directly, from module 0.29.0. */
  const sendSpend = useCallback(
    (spent: LocalUse, { counter, count }: Omit<SpendSource, 'kind'>) => {
      const { kinds, on } = latest.current
      if (!on || !kinds.includes('spend')) return
      start(
        spent.id,
        { kind: 'spend', counter, count, ...PLAIN },
        {},
        spent.label,
      )
    },
    [start],
  )

  /** Use or gain Heroic Inspiration, from module 0.29.0. */
  const sendInspiration = useCallback(
    (changed: LocalUse, inspiration: InspirationSource['inspiration']) => {
      const { kinds, on } = latest.current
      if (!on || !kinds.includes('inspiration')) return
      start(
        changed.id,
        { kind: 'inspiration', inspiration, ...PLAIN },
        {},
        changed.label,
      )
    },
    [start],
  )

  /**
   * Move items or coins between the character and a party or another character, from module
   * 0.31.0. No switch of this device's holds it back: a move has no version made here instead.
   */
  const sendTransfer = useCallback(
    (moved: LocalUse, transfer: TransferInput) => {
      if (!moved.move) return
      start(
        moved.id,
        { kind: 'transfer', transfer, ...PLAIN },
        { move: moved.move },
        moveLabel(moved.move),
      )
    },
    [start],
  )

  /**
   * Remove an item from the character, from module 0.33.0. No switch of this device's holds it
   * back: a removal has no version made here instead.
   */
  const sendRemove = useCallback(
    (removed: LocalUse, remove: RemoveInput) => {
      if (!removed.move) return
      start(
        removed.id,
        { kind: 'remove', remove, ...PLAIN },
        { move: removed.move },
        moveLabel(removed.move),
      )
    },
    [start],
  )

  /**
   * Add to or remove from the character's favorites, from module 0.37.0. No switch of this device's
   * holds it back: a favorite has no version made here instead.
   */
  const sendFavorite = useCallback(
    (logged: LocalUse, favorite: FavoriteInput) => {
      if (!logged.favorite) return
      start(
        logged.id,
        { kind: 'favorite', favorite, ...PLAIN },
        { favorite: logged.favorite },
        logged.label,
      )
    },
    [start],
  )

  /**
   * Turn one of the character's own effects off or on, or delete it, from module 0.39.0, named as
   * the sheet names it. No switch of this device's holds it back, as with a favorite: it has no
   * version made here instead.
   */
  const sendEffect = useCallback(
    (logged: LocalUse, effect: Pick<SheetEffect, 'id' | 'name'>) => {
      const op = logged.effect
      if (!op) return
      start(
        logged.id,
        labelled(
          { kind: 'effect', effect: { op, id: effect.id }, ...PLAIN },
          effect.name,
        ),
        { effect: op },
        logged.label,
      )
    },
    [start],
  )

  /**
   * Use Wild Shape from here, from module 0.40.0: a change into a known form, a return, or a Beast
   * learned. No switch of this device's holds it back, as with an effect: it throws no dice, and
   * has no version made here instead.
   */
  const sendWildShape = useCallback(
    (logged: LocalUse, wildShape: Exclude<WildShapeInput, { op: 'forms' }>) => {
      if (!logged.wildShape) return
      start(
        logged.id,
        { kind: 'wildShape', wildShape, ...PLAIN, label: 'Wild Shape' },
        { wildShape: wildShape.op },
        logged.label,
      )
    },
    [start],
  )

  /**
   * The Beasts the druid may learn, from module 0.40.0, as the game lists them now: asked and
   * followed as any request is, but apart from the rolls, logging nothing and drawing no line in
   * the tray. Given up on as the page is left.
   */
  const readWildShapeForms = useCallback(async (): Promise<WildShapeForms> => {
    const controller = new AbortController()
    running.current.add(controller)
    let last: TableRollState = { status: 'sending' }
    try {
      await follow(
        latest.current.api,
        { kind: 'wildShape', wildShape: { op: 'forms' }, ...PLAIN },
        controller.signal,
        state => {
          last = state
        },
        () => {},
      )
    } finally {
      running.current.delete(controller)
    }
    const listed = last.wildShaped
    if (last.status === 'done' && listed?.op === 'forms') {
      return { forms: listed.forms, more: listed.more, limits: listed.limits }
    }
    return {
      reason: last.reason ?? (last.status === 'done' ? 'error' : last.status),
    }
  }, [])

  const sendAsk = useCallback((asked: LocalAsk, { text, link }: TextLink) => {
    const { kinds, on } = latest.current
    if (!on || !kinds.includes('ask')) return
    start(
      asked.id,
      {
        kind: 'ask',
        text,
        link,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      },
      {},
      asked.label,
    )
  }, [])

  /**
   * Roll a spent recharge in the game, from module 0.36.0: dnd5e's own, with the player's d6, for
   * an item's own uses or one of its activities'.
   */
  const sendRecharge = useCallback(
    (roll: RechargeRoll, rolled: LocalFormula) => {
      const { kinds, on } = latest.current
      if (!on || !kinds.includes('recharge')) return
      const { item, activity } = roll.counter
      start(
        rolled.id,
        {
          kind: 'recharge',
          item,
          ...(activity && { activity }),
          mode: 0,
          explicit: false,
          extras: [],
          dice: [{ faces: 6, results: rolled.terms[0]?.values ?? [] }],
          ...(rolled.typed && { typed: true as const }),
          ...(rolled.typed &&
            rolled.rerolls === 'kept' && { rerolls: 'kept' as const }),
        },
        // So that the tray words its outcome as a recharge's, not a save's.
        { recharge: true },
        roll.label,
      )
    },
    [start],
  )

  const setSending = useCallback(
    (next: boolean) => choose(next ? 'on' : 'off'),
    [choose],
  )
  const setAlone = useCallback(
    (next: boolean) => chooseAlone(next ? 'on' : 'off'),
    [chooseAlone],
  )
  // A use's damage left for the player to roll, while they type in their own dice: once.
  const offerDamage = useCallback((localId: string) => {
    setStates(held => {
      const state = held.get(localId)
      if (!state || state.offer) return held
      return new Map(held).set(localId, { ...state, offer: true })
    })
  }, [])
  return {
    send,
    sendDamage,
    sendFormula,
    sendUse,
    sendEnd,
    sendEndConcentration,
    sendSpend,
    sendInspiration,
    sendTransfer,
    sendRemove,
    sendFavorite,
    sendEffect,
    sendWildShape,
    readWildShapeForms,
    sendAsk,
    sendRecharge,
    offerDamage,
    states,
    /** Whether the game takes any of the player's rolls now. */
    available: kinds.length > 0,
    /** Whether the player sends their rolls from this device. */
    sending: on,
    setSending,
    /**
     * Whether damage the player rolls goes to the game on its own from this device now, from
     * module 0.36.0: with Send to the table on, their switch on, and the game taking it.
     */
    sendsAlone,
    /** Whether the game takes damage on its own, for the player's switch to show. */
    aloneOffered: kinds.includes('itemDamage'),
    /**
     * Whether the game takes damage on its own's choices, from module 0.41.0: its slot, attack
     * mode and ammunition, and spending what its use would, on a row whose sheet sends them.
     */
    aloneChoices:
      kinds.includes('itemDamage') && features.includes('aloneChoices'),
    /** Whether the player's switch for damage on its own is on, on this device. */
    aloneOn: alone === 'on',
    setAlone,
    /** Whether the game takes this kind of roll from this device now. */
    takes: (kind: RollKind) => on && kinds.includes(kind),
    /**
     * Whether a d20 roll from the sheet goes to the game from this device now, as `send` sends it:
     * the same function each render, read as the roll is made.
     */
    sends,
    /** Whether the game takes damage the player changed from this device now. */
    modifies: on && kinds.includes('damage') && features.includes('modifiers'),
    /**
     * Whether the game takes a description's damage the player changed from this device now, as
     * it may from module 0.19.0, whose sheets say how it makes a critical hit's.
     */
    modifiesText:
      on && kinds.includes('textDamage') && features.includes('modifiers'),
    /**
     * Whether the game changes a description's damage only on a die it adds, from module 0.21.0;
     * before, on its first die whatever its sign.
     */
    signsText: features.includes('signedDice'),
    /**
     * Whether the game takes the dice a typed d20 roll's effects add, such as Bless's d4, as its
     * player typed them, from module 0.42.0, from this device now: they're asked for, or skipped
     * for the game to roll, only of a roll it's sent (`sends`). One the player keeps to themselves
     * asks none, as no game would roll one skipped.
     */
    typedEffects: on && features.includes('effectDice'),
    /**
     * Whether the game keeps the dice of a typed roll as its player rerolled them at the table,
     * rerolling none of them itself, from module 0.42.0.
     */
    keptRerolls: features.includes('keptRerolls'),
    /** Whether the game makes an area attack at the combatants picked, from this device now. */
    areas: on && kinds.includes('attack') && features.includes('areaAttacks'),
    /**
     * Whether the game makes a use at its user as asked, from module 0.22.0, from this device now:
     * where it isn't in the combat, or there's none.
     */
    selfTargets:
      on && kinds.includes('use') && features.includes('selfTargets'),
    /**
     * The saves the game asked for that the player has answered from this page, on their way to
     * the game or made there: not to be answered again.
     */
    answering: answeringOf(states),
    /** The attack or use at the table with this id, if its damage is still to roll there. */
    dueDamage: (use: string) => dueOf(states, state => state.requestId === use),
    /**
     * The latest use at the table made with this item and activity, or enchantment ended from it,
     * as it stands, if any: for an enchant activity's switch.
     */
    latestFor: (source: AttackSource) =>
      [...states.values()].findLast(
        state =>
          state.source?.item === source.item &&
          state.source.activity === source.activity,
      ),
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

/** How what throws no dice, and is rolled no way, is sent: as it is, with nothing added. */
const PLAIN = {
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
} as const satisfies Pick<
  RollRequestInput,
  'mode' | 'explicit' | 'extras' | 'dice'
>

/** None of the Gamemaster's rolls, the same each time, for what's worked out from them to keep. */
const NO_GM_ROLLS: readonly GmRollView[] = []

/**
 * The rolls the campaign's Gamemaster made as the player's character (#156), as the player's view
 * tells them, to show among the player's own: each as a roll of this page's, apart from its own by
 * its id, and its way to the game, as the player's own are followed, with the game's result; but
 * never the damage that follows one, which the Gamemaster rolls, so that it waits for nothing. An
 * area attack's targets are named as the player's own view of the combat names them (`namesOf`).
 * @param heard - When this page first heard of each, by this device's clock (`useGmRolls`), to
 *   place it among the player's own by; else it's placed by when it was sent.
 * @param combat - The combat as the player's view has it, which names the targets.
 */
export function gmRollsOf(
  views: readonly GmRollView[] = NO_GM_ROLLS,
  heard?: ReadonlyMap<string, number>,
  combat?: TableCombat,
): {
  rolls: LocalGmRoll[]
  states: ReadonlyMap<string, TableRollState>
} {
  const rolls = views.map((view): LocalGmRoll => ({
    kind: 'gm',
    id: `gm:${view.id}`,
    label: view.label,
    rolled: view.kind,
    at: heard?.get(view.id) ?? Date.parse(view.at),
    ...(view.healing && { healing: true }),
  }))
  const states = new Map(
    views.map(view => {
      const { status, reason, visible, total, attack, outcome, healed } = view
      const { spent, enchantment, d20, critical } = view
      const names = namesOf(attack, combat)
      const state: TableRollState = {
        status,
        ...(reason !== undefined && { reason }),
        ...(visible !== undefined && { visible }),
        ...(total !== undefined && { total }),
        ...(attack && { attack }),
        ...(names && { targetNames: names }),
        ...(outcome && { outcome }),
        ...(healed !== undefined && { healed }),
        ...(spent && { spent }),
        ...(enchantment && { enchantment }),
        ...(d20 && { d20 }),
        ...(critical && { critical }),
        // Hit dice the game stopped spending part way, which it made some of, say how many.
        ...(status === 'failed' &&
          (spent?.made ?? 0) > 0 && { together: spent }),
        // Worded as the player's own recharges and damage on its own are, from module 0.36.0.
        ...(view.kind === 'recharge' && { recharge: true as const }),
        ...(view.kind === 'itemDamage' && { alone: true as const }),
        requestId: view.id,
      }
      return [`gm:${view.id}`, state] as const
    }),
  )
  return { rolls, states }
}

/**
 * The names of an area attack's targets of the Gamemaster's (#156), by their ids, as the player's
 * own view of the combat names them: only ever names its player may see, as that view leaves out
 * those hidden from players, never names the Gamemaster's page saw. None of a target that view
 * doesn't hold, nor of an attack at one target, which says nothing of whom.
 */
function namesOf(
  attack: GmRollView['attack'],
  combat?: TableCombat,
): Record<string, string> | undefined {
  const targets = attack?.targets ?? []
  if (!combat || targets.length < 2) return undefined
  const names = targets.flatMap(({ combatId, combatantId }) => {
    const combatant =
      combatId === combat.id
        ? combat.combatants.find(({ id }) => id === combatantId)
        : undefined
    return combatant ? [[combatantId, combatant.name] as const] : []
  })
  return names.length > 0 ? Object.fromEntries(names) : undefined
}

/**
 * The rolls the campaign's Gamemaster made as the player's character (#156), as `gmRollsOf` has
 * them, each placed among the player's own by when this page first heard of it, by this device's
 * clock, as theirs are: never by when the server says it was sent, as this device's clock may be
 * behind the server's or ahead of it. So one heard of after the player rolled is newer than their
 * roll, and one heard of before it older. Those the page opens with are heard of as it opens, in
 * the order the view has them, as are those one look at the table brings. An area attack's targets
 * are named as the player's view of the combat names them now.
 */
export function useGmRolls(
  views: readonly GmRollView[] = NO_GM_ROLLS,
  combat?: TableCombat,
): ReturnType<typeof gmRollsOf> {
  const [heard, setHeard] = useState(() => heardOf(new Map(), views))
  let known = heard
  // Those the view brings, heard of now: the page renders again at once with them.
  if (views.some(({ id }) => !heard.has(id))) {
    known = heardOf(heard, views)
    setHeard(known)
  }
  return useMemo(() => gmRollsOf(views, known, combat), [views, known, combat])
}

/**
 * When this page first heard of each of the Gamemaster's rolls the view has, those new to it now:
 * none it no longer has, which never come back, as they only grow older.
 */
function heardOf(
  held: ReadonlyMap<string, number>,
  views: readonly GmRollView[],
): ReadonlyMap<string, number> {
  const now = Date.now()
  return new Map(views.map(({ id }) => [id, held.get(id) ?? now]))
}

/**
 * The page's own rolls and the Gamemaster's as the character together (#156), newest first by when
 * each was made, or for the Gamemaster's, heard of, and their ways to the game.
 */
export function withGmRolls(
  rolls: readonly LocalRoll[],
  states: ReadonlyMap<string, TableRollState>,
  gm: ReturnType<typeof gmRollsOf>,
): { rolls: LocalRoll[]; states: ReadonlyMap<string, TableRollState> } {
  if (gm.rolls.length === 0) return { rolls: [...rolls], states }
  return {
    rolls: [...rolls, ...gm.rolls].toSorted((a, b) => b.at - a.at),
    states: new Map([...states, ...gm.states]),
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

/**
 * Rolls sent one after another, as one: where the latest sent is on its way; or, once each is made,
 * what the game made of them all, their totals and the hit points they gave back added up; or that
 * one of them wasn't made, and why, after how many were.
 */
function together(each: TableRollState[], count: number): TableRollState {
  const made = each.filter(({ status }) => status === 'done')
  const latest = each.at(-1) ?? { status: 'sending' }
  const visible = made.length > 0 && made.every(state => state.visible)
  const totals = made.map(({ total }) => total)
  const healed = made.map(state => state.healed)
  const status =
    latest.status === 'done' && made.length < count ? 'sending' : latest.status
  return {
    status,
    ...(latest.reason !== undefined && { reason: latest.reason }),
    ...(made.length > 0 && { visible }),
    ...(visible && known(totals) && { total: added(totals) }),
    ...(visible && known(healed) && { healed: added(healed) }),
    together: { count, made: made.length },
  }
}

/**
 * A roll as the Gamemaster's page sends it (#156): with what it calls it, for the character's
 * player to be shown it by, cut to as long a name as the app keeps, never splitting a character,
 * and left out where there's nothing to say.
 */
export function labelled(
  input: RollRequestInput,
  label: string,
): RollRequestInput {
  let kept = ''
  for (const character of label.trim()) {
    if (kept.length + character.length > MAX_ROLL_LABEL) break
    kept += character
  }
  return kept ? { ...input, label: kept } : input
}

/** Whether the app turned a roll away as one too many at once, to send again a moment later. */
function busy(state: TableRollState): boolean {
  return state.status === 'refused' && state.reason === 'busy'
}

/** Whether every number is known. */
function known(numbers: (number | undefined)[]): numbers is number[] {
  return numbers.every(number => number !== undefined)
}

/** Numbers added up. */
function added(numbers: number[]): number {
  return numbers.reduce((sum, number) => sum + number, 0)
}

/**
 * Send a roll to the game, then ask after it until it's made, or given up on.
 * @param api - The seat's API base, such as `/api/characters/<id>`.
 */
export async function follow(
  api: string,
  input: RollRequestInput,
  signal: AbortSignal,
  update: (state: TableRollState) => void,
  taken: (id: string) => void,
) {
  let id: string
  try {
    const response = await fetch(`${api}/rolls`, {
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
      const response = await fetch(`${api}/rolls/${id}`, {
        cache: 'no-store',
        signal,
      })
      // A roll this page can't see any more, such as once signed out, is given up on.
      if (response.status === 401 || response.status === 404) break
      if (response.ok) {
        // What became of an effect (module 0.39.0), or of Wild Shape (module 0.40.0), is kept
        // apart from what was asked; and so is what damage on its own spent (module 0.41.0),
        // apart from the hit dice a request spent.
        const {
          effect: changed,
          wildShape: wildShaped,
          alone: made,
          ...view
        } = (await response.json()) as RollRequestView
        update({
          ...view,
          ...(changed && { changed }),
          ...(wildShaped && { wildShaped }),
          ...(made && { aloneSpent: made.spent }),
          ...(made?.concentrating && { concentrating: true as const }),
          requestId: id,
        })
        // A roll that took too long may still be made, once the Gamemaster answers; but not hit
        // dice the game says it made some of before it stopped, as it does once it had to.
        if (
          view.status === 'failed' &&
          view.reason === 'timeout' &&
          !view.spent
        ) {
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
export async function refusal(response: Response): Promise<string> {
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
    // What the game asked for that it answers: a saving throw, or an ability or skill check
    // Midi-QOL asked for.
    ...('prompt' in source && source.prompt && { prompt: source.prompt }),
    // A saving throw or check a description calls for, which the game makes against the DC it
    // names.
    ...('text' in source &&
      source.text !== undefined &&
      source.link !== undefined && { text: source.text, link: source.link }),
    // A check an activity asks for, which the game makes against the activity, as its card does.
    ...(activityCheck(source) && {
      item: source.item,
      activity: source.activity,
    }),
    ...(source.kind === 'attack' && {
      item: source.item,
      activity: source.activity,
      ...(source.targets
        ? { targets: source.targets }
        : // eslint-disable-next-line unicorn/no-null -- the protocol's for no target
          { target: source.target ?? null }),
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
    // Its player typed its dice in, from their own, from module 0.32.0.
    ...(check.typed && { typed: true as const }),
    // And from module 0.42.0, the dice its effects add that they typed in, after the dice of the
    // terms they added, none skipped; and that they rerolled at the table, as their feature says.
    ...(check.typed &&
      check.effectDice?.length && { effectDice: check.effectDice }),
    ...(check.typed &&
      check.rerolls === 'kept' && { rerolls: 'kept' as const }),
  }
}

/** Is a roll a check an activity asks for, the player's own, by its item and activity? */
function activityCheck(
  source: RollSource,
): source is Extract<RollSource, { kind: 'skill' | 'tool' | 'ability' }> &
  ActivityRef {
  return (
    ['skill', 'tool', 'ability'].includes(source.kind) &&
    'activity' in source &&
    source.item !== undefined &&
    source.activity !== undefined
  )
}

/**
 * A hit die spent, or a formula rolled, as the game is asked to make it: the hit die's size, the
 * formula's item and activity, or the description's link it's in, and the dice of each of its
 * terms, in order, each term's first throw, as Foundry throws again itself any die it rerolls or
 * explodes.
 */
export function toFormulaRequest(
  roll: SheetFormulaRoll,
  source: Exclude<FormulaSource, { kind: 'hitDice' }>,
  rolled: LocalFormula,
): RollRequestInput {
  return {
    kind: source.kind,
    ...formulaOrigin(source),
    mode: 0,
    explicit: false,
    extras: [],
    dice: roll.terms.flatMap((term, index) =>
      'sides' in term
        ? [{ faces: term.sides, results: rolled.terms[index]?.values ?? [] }]
        : [],
    ),
    ...(rolled.typed && { typed: true as const }),
    ...(rolled.typed &&
      rolled.rerolls === 'kept' && { rerolls: 'kept' as const }),
  }
}

/**
 * Hit dice spent at once as the game is asked to spend them, from module 0.20.0: how many of each
 * size, the largest first, and each size's dice, as thrown, in the same order.
 */
export function toHitDiceRequest(
  source: Extract<FormulaSource, { kind: 'hitDice' }>,
  rolled: LocalFormula,
): RollRequestInput {
  return {
    kind: 'hitDice',
    hitDice: source.hitDice,
    mode: 0,
    explicit: false,
    extras: [],
    dice: source.hitDice.map(({ denomination }, index) => ({
      faces: Number(denomination.slice(1)),
      results: rolled.terms[index]?.values ?? [],
    })),
    ...(rolled.typed && { typed: true as const }),
    ...(rolled.typed &&
      rolled.rerolls === 'kept' && { rerolls: 'kept' as const }),
  }
}

/**
 * Hit dice spent at once as a game before module 0.20.0 is asked to spend them: a hit die each, its
 * own die as thrown, the largest first, in the order thrown.
 */
export function toHitDieRequests(
  source: Extract<FormulaSource, { kind: 'hitDice' }>,
  rolled: LocalFormula,
): RollRequestInput[] {
  return source.hitDice.flatMap(({ denomination }, index) =>
    (rolled.terms[index]?.values ?? []).map(value => ({
      kind: 'hitDie' as const,
      denomination,
      mode: 0 as const,
      explicit: false,
      extras: [],
      dice: [{ faces: Number(denomination.slice(1)), results: [value] }],
      ...(rolled.typed && { typed: true as const }),
      ...(rolled.typed &&
        rolled.rerolls === 'kept' && { rerolls: 'kept' as const }),
    })),
  )
}

/** What a formula rolled is, for the game to find it. */
function formulaOrigin(
  source: Exclude<FormulaSource, { kind: 'hitDice' }>,
): Partial<RollRequestInput> {
  switch (source.kind) {
    case 'hitDie': {
      return { denomination: source.denomination }
    }
    case 'formula': {
      return { item: source.item, activity: source.activity }
    }
    case 'textRoll': {
      return { text: source.text, link: source.link }
    }
  }
}

/**
 * Damage's dice as thrown, part by part and term by term, for the game to roll them too: each
 * term's first throw, as Foundry throws again itself any die it rerolls or explodes.
 */
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
 * part, with its dice as the game will throw them, a critical hit's already doubled, those it takes
 * away with their signs, and its numbers where the app can read them, as the kind of damage
 * chosen, if any, and changed as the player chose. Damage the game can't say beforehand has no
 * dice here: the game rolls them. Damage whose dice the game won't change is marked `fixed`: one
 * with no first die to change, or, from a module before 0.21.0, one whose first die it would
 * change is one it takes away. Changes chosen as it was used that the game's damage can't take
 * are left out, and it's rolled without them: its highest where it takes a die away, its formula
 * saying so for damage the game rolls itself; more dice where it has no first die to change; and
 * more than its first die may still take, as a spell cast higher than its label has, down to as
 * many as it may.
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
  const marked = marksTaken(damage)
  const kept = takenModifiers(damage, modifiers)
  const rolls = damage.rolls.map(roll =>
    damage.plannable ? termsOf(roll, marked) : { terms: [], read: true },
  )
  return {
    label: `${label} ${healing ? 'healing' : 'damage'}`,
    critical: damage.critical,
    healing,
    exact: true,
    use,
    ...(types && { types }),
    ...(kept && changes(kept) && { modifiers: kept }),
    perDie: damage.rolls[0]?.perDie ?? 1,
    ...(damage.plannable && changedAt(damage) < 0 && { fixed: true as const }),
    // A formula whose numbers the app can't read, as one a module writes in a way of its own for
    // a critical hit, adds up as the game says, rather than as its bare dice.
    ...(rolls.some(({ read }) => !read) && { gameTotal: true as const }),
    parts: damage.rolls.map((roll, index) => ({
      type: chosenLabel(roll, types?.[index]) ?? roll.type,
      terms: rolls[index].terms,
    })),
  }
}

/** The kinds of damage among which a roll of damage lets its roller choose, if any. */
export function choicesOf(damage: DamagePreview) {
  return damage.rolls.find(roll => (roll.types?.length ?? 0) > 1)?.types ?? []
}

/**
 * Whether a roll's damage is due: an attack the game made, whose damage is still to roll, or a use
 * whose damage or healing waits for its kind to be chosen, or, while its player types in their own
 * dice, for them to roll it, as any other use's is rolled at once. The tray offers that damage to
 * roll while it is, after a miss too, for what deals damage on one.
 */
export function damageDue(roll: LocalRoll, state?: TableRollState): boolean {
  if (state?.status !== 'done' || !state.damage || state.damaged) return false
  if (!state.requestId) return false
  if (roll.kind === 'check') return true
  return (
    roll.kind === 'use' &&
    (choicesOf(state.damage).length > 0 || state.offer === true)
  )
}

/**
 * Whether a roll waits for its player, its toast staying until they act: its damage is due
 * (`damageDue`), and it isn't an attack that missed, whose toast goes as any other's does, its
 * damage still offered where it's due. A use has no hit or miss, and an attack the game says
 * nothing of counts as a hit.
 */
export function needsPlayer(roll: LocalRoll, state?: TableRollState): boolean {
  if (!damageDue(roll, state)) return false
  return roll.kind !== 'check' || !missed(state)
}

/**
 * Whether an attack the game made missed: its target, or everyone in its area the game says of,
 * as the tray's "Hit 0 of 2". Not where the game says nothing of it.
 */
export function missed(state?: TableRollState): boolean {
  const attack = state?.attack
  if (!attack) return false
  const told = (attack.targets ?? []).filter(({ outcome }) => outcome !== null)
  if (attack.targets && attack.targets.length > 1 && told.length > 0) {
    return told.every(({ outcome }) => outcome === 'miss')
  }
  return attack.outcome === 'miss'
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
 * A roll's terms, as its formula has them, when they throw the dice the game said, with their
 * signs, each die with what Foundry does with it, such as 2d6r<=2's reroll; otherwise its dice
 * alone. Either way, its dice have their signs, as the game marks them,
 * or as its formula has them for a module before 0.21.0; and the dice of a critical hit's critical
 * damage are marked added, as the game marks them, so that none is ever its first die. Whether its
 * formula was read, `read`: not where its dice alone are left, its numbers lost.
 * @param marked - Whether the game marks the dice the damage takes away.
 */
function termsOf(
  roll: DamagePreview['rolls'][number],
  marked: boolean,
): { terms: ExtraTerm[]; read: boolean } {
  const dice = signedDice(roll, marked).map(
    ({ faces, number, added, subtracted }) => ({
      sign: subtracted ? (-1 as const) : (1 as const),
      count: number,
      sides: faces as Extract<ExtraTerm, { sides: number }>['sides'],
      ...(added && { added }),
    }),
  )
  const terms = formulaTerms(roll.formula)
  if (!terms) return { terms: dice, read: false }
  const thrown = terms.filter(term => 'sides' in term)
  const same =
    thrown.length === dice.length &&
    thrown.every(
      (term, index) =>
        term.sign === dice[index].sign &&
        term.count === dice[index].count &&
        term.sides === dice[index].sides,
    )
  if (!same) return { terms: dice, read: false }
  // Its terms of dice are its dice, in order.
  let index = 0
  return {
    terms: terms.map(term => {
      if (!('sides' in term)) return term
      const { added } = dice[index++]
      return added ? { ...term, added } : term
    }),
    read: true,
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
