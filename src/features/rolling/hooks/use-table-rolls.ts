'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BUSY_FOR, BUSY_WAIT } from '@/constants/lifecycle'
import {
  GM_SEND_KEY,
  SEND_KEY,
  SEND_CHOICES,
  GM_ALONE_KEY,
  ALONE_KEY,
} from '@/features/rolling/constants'
import { useStoredChoice } from '@/hooks/use-stored'
import { useTableApi, useTableRole } from '@/hooks/use-table-api'
import { changes } from '@/utils/damage-modifiers'
import { labelled, follow, pause } from '@/utils/lifecycle'
import { moveLabel } from '@/utils/move-words'
import type { WildShapeForms, DueDamage } from '@/features/rolling/types'
import type {
  TableRollState,
  DamageModifiers,
  ActivityRef,
  EndEnchantmentSource,
  FavoriteInput,
  FormulaSource,
  InspirationSource,
  PrepareInput,
  RemoveInput,
  RolledDice,
  RollFeature,
  RollKind,
  RollRequestInput,
  RollSource,
  SpellSlotInput,
  SpendSource,
  TextLink,
  TransferInput,
  UseSource,
  WildShapeInput,
  LocalAsk,
  LocalCheck,
  LocalDamage,
  LocalFormula,
  LocalUse,
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
  AttackSource,
} from '@/types/roll'
import type { SheetEffect } from '@/types/sending-stone'

/**
 * A spent recharge rolled (module 0.36.0): what it's called, and the uses it recharges, as the
 * sheet names them: an item's own, or one of its activities'.
 */
export type RechargeRoll = {
  label: string
  counter: { item: string; activity?: string }
}

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
   * Spend one of the character's spell slots, or restore one, from module 0.42.1, from the count
   * of its pool the dots showed: no roll, as charges spent aren't, but its way kept as which.
   */
  const sendSpellSlot = useCallback(
    (changed: LocalUse, spellSlot: SpellSlotInput) => {
      const { kinds, on } = latest.current
      if (!on || !kinds.includes('spellSlot')) return
      start(
        changed.id,
        { kind: 'spellSlot', spellSlot, ...PLAIN },
        { spellSlot: spellSlot.op },
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
   * Prepare one of the character's spells, or unprepare it, from module 0.42.1, by its id on the
   * sheet. No switch of this device's holds it back, as with a favorite: it has no version made
   * here instead; the app answers one the game no longer takes.
   */
  const sendPrepare = useCallback(
    (logged: LocalUse, prepare: PrepareInput) => {
      if (!logged.prepare) return
      start(
        logged.id,
        { kind: 'prepare', prepare, ...PLAIN },
        { prepare: logged.prepare },
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
    sendSpellSlot,
    sendTransfer,
    sendRemove,
    sendFavorite,
    sendEffect,
    sendPrepare,
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
     * Whether the game takes this kind at all, whatever this device's Send to the table: for what
     * has no version made here, as a spell prepared (module 0.42.1).
     */
    lists: (kind: RollKind) => kinds.includes(kind),
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
        : // the protocol's for no target
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

function modeOf(advantage: LocalCheck['advantage']): -1 | 0 | 1 {
  if (advantage === 'adv') return 1
  if (advantage === 'dis') return -1
  return 0
}
