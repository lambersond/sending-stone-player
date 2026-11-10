'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BUSY_FOR, BUSY_WAIT } from '@/constants/lifecycle'
import { NO_DICE } from '@/constants/roll-kinds'
import {
  SEND_CHOICES,
  GM_ALONE_KEY,
  ALONE_KEY,
} from '@/features/rolling/constants'
import { useSendChoice } from '@/features/rolling/hooks/use-send-choice'
import {
  activityCheck,
  toAloneRequest,
  toDamageRequest,
  toFormulaRequest,
  toHitDiceRequest,
  toHitDieRequests,
  toRechargeRequest,
  toRollRequest,
  toTextDamageRequest,
} from '@/features/rolling/utils/request-bodies'
import {
  answeringOf,
  busy,
  damageUnmade,
  dueOf,
  rollStates,
} from '@/features/rolling/utils/roll-states'
import { useFollow } from '@/hooks/use-follow'
import { useStoredChoice } from '@/hooks/use-stored'
import { useTableApi, useTableRole } from '@/hooks/use-table-api'
import { changes } from '@/utils/damage-modifiers'
import { labelled, follow, pause } from '@/utils/lifecycle'
import { moveLabel } from '@/utils/move-words'
import type { WildShapeForms, RechargeRoll } from '@/features/rolling/types'
import type {
  TableRollState,
  DamageModifiers,
  EndEnchantmentSource,
  FavoriteInput,
  HitPointsInput,
  InspirationSource,
  PrepareInput,
  RemoveInput,
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
  const [choice, choose] = useSendChoice(gm)
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
  const followRoll = useFollow()
  // The requests awaited here, as rolls sent one after another are, each given up on as the page
  // is left, as `followRoll` gives up on the rest.
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
   * @param heard - Told each way it goes, as it's kept.
   */
  const start = useCallback(
    (
      localId: string,
      sent: RollRequestInput,
      kept: Partial<TableRollState>,
      label: string,
      heard?: (state: TableRollState) => void,
    ) => {
      const input = latest.current.gm ? labelled(sent, label) : sent
      const update = (state: TableRollState) => {
        setStates(held =>
          rollStates(held, { type: 'way', id: localId, kept, state }),
        )
        heard?.(state)
      }
      update({ status: 'sending' })
      followRoll(latest.current.api, input, update, id => {
        kept = { ...kept, requestId: id }
      })
    },
    [followRoll],
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
            rollStates(held, {
              type: 'together',
              id: localId,
              each,
              count: inputs.length,
            }),
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
      const { use, text, alone } = roll
      // An action's damage or healing on its own, from module 0.36.0, where the player sends it so:
      // no attack or use made, for the Gamemaster to apply from dnd5e's card. Otherwise, it's the
      // player's alone.
      if (alone) {
        if (!latest.current.sendsAlone) return
        // Its slot, attack mode and ammunition, and whether it spends what its use would, from
        // module 0.41.0, only to a game that takes them (round 0.41.0 §2.10).
        const choosing = latest.current.features.includes('aloneChoices')
        const consume = choosing && alone.consume === true
        start(
          damage.id,
          toAloneRequest(roll, damage, alone, { choosing, consume }),
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
        if (!takes(latest.current, 'textDamage')) return
        if (roll.critical && (!roll.criticalRule || !roll.criticalAdds)) return
        start(
          damage.id,
          toTextDamageRequest(roll, damage, text),
          {},
          roll.label,
        )
        return
      }
      if (!use || !takes(latest.current, 'damage')) return
      // Its attack's or use's damage is on its way: it isn't offered again, unless the game doesn't
      // make it after all.
      setStates(held => rollStates(held, { type: 'damaged', use }))
      start(
        damage.id,
        toDamageRequest(roll, damage, use),
        {},
        roll.label,
        state => {
          if (damageUnmade(state)) {
            setStates(held => rollStates(held, { type: 'undamaged', use }))
          }
        },
      )
    },
    [start],
  )

  const sendUse = useCallback(
    (used: LocalUse, use: UseSource, modifiers?: DamageModifiers) => {
      if (!takes(latest.current, 'use')) return
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
          ...NO_DICE,
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
      if (!takes(latest.current, 'endEnchantment')) return
      start(
        ended.id,
        {
          kind: 'endEnchantment',
          enchantment: { item, effect },
          ...NO_DICE,
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
      if (!takes(latest.current, 'endConcentration')) return
      start(
        ended.id,
        {
          kind: 'endConcentration',
          concentration: { effect },
          ...NO_DICE,
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
      if (!takes(latest.current, 'spend')) return
      start(
        spent.id,
        { kind: 'spend', counter, count, ...NO_DICE },
        {},
        spent.label,
      )
    },
    [start],
  )

  /** Use or gain Heroic Inspiration, from module 0.29.0. */
  const sendInspiration = useCallback(
    (changed: LocalUse, inspiration: InspirationSource['inspiration']) => {
      if (!takes(latest.current, 'inspiration')) return
      start(
        changed.id,
        { kind: 'inspiration', inspiration, ...NO_DICE },
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
      if (!takes(latest.current, 'spellSlot')) return
      start(
        changed.id,
        { kind: 'spellSlot', spellSlot, ...NO_DICE },
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
        { kind: 'transfer', transfer, ...NO_DICE },
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
        { kind: 'remove', remove, ...NO_DICE },
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
        { kind: 'favorite', favorite, ...NO_DICE },
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
          { kind: 'effect', effect: { op, id: effect.id }, ...NO_DICE },
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
        { kind: 'prepare', prepare, ...NO_DICE },
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
        { kind: 'wildShape', wildShape, ...NO_DICE, label: 'Wild Shape' },
        { wildShape: wildShape.op },
        logged.label,
      )
    },
    [start],
  )

  /**
   * Set the hit points and temporary hit points of the character, its form's while shaped, or at
   * a companion's own pane the companion's, from module 0.44.0, from the numbers the page showed.
   * No switch of this device's holds it back, as with an effect: it throws no dice, and has no
   * version made here instead; nor do the rolls, as the campaign has a switch of its own for it.
   */
  const sendHitPoints = useCallback(
    (logged: LocalUse, hitPoints: HitPointsInput) => {
      if (!logged.hitPoints) return
      start(
        logged.id,
        { kind: 'hitPoints', hitPoints, ...NO_DICE },
        { hitPoints: true },
        logged.label,
      )
    },
    [start],
  )

  /**
   * The Beasts the druid may learn, from module 0.40.0, as the game lists them now: asked and
   * followed as any request is, but apart from the rolls, logging nothing and drawing no line in
   * the tray. Given up on as the page is left. One the app took with no id to follow it by has
   * nothing to read back, which the game isn't to blame for (`unfollowed`).
   */
  const readWildShapeForms = useCallback(async (): Promise<WildShapeForms> => {
    const controller = new AbortController()
    running.current.add(controller)
    let last: TableRollState = { status: 'sending' }
    try {
      await follow(
        latest.current.api,
        { kind: 'wildShape', wildShape: { op: 'forms' }, ...NO_DICE },
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
    if (last.unfollowed) return { reason: 'unfollowed' }
    return {
      reason: last.reason ?? (last.status === 'done' ? 'error' : last.status),
    }
  }, [])

  const sendAsk = useCallback(
    (asked: LocalAsk, { text, link }: TextLink) => {
      if (!takes(latest.current, 'ask')) return
      start(
        asked.id,
        {
          kind: 'ask',
          text,
          link,
          ...NO_DICE,
        },
        {},
        asked.label,
      )
    },
    [start],
  )

  /**
   * Roll a spent recharge in the game, from module 0.36.0: dnd5e's own, with the player's d6, for
   * an item's own uses or one of its activities'.
   */
  const sendRecharge = useCallback(
    (roll: RechargeRoll, rolled: LocalFormula) => {
      if (!takes(latest.current, 'recharge')) return
      start(
        rolled.id,
        toRechargeRequest(roll, rolled),
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
    setStates(held => rollStates(held, { type: 'offer', id: localId }))
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
    sendHitPoints,
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

/** Whether the game takes this kind of roll from this device now, as `latest` has it. */
function takes(
  { kinds, on }: { kinds: readonly RollKind[]; on: boolean },
  kind: RollKind,
): boolean {
  return on && kinds.includes(kind)
}
