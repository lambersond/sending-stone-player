import { SPELL_SLOT_OPS } from '@/constants/sending-stone'
import { rollStatus } from '@/utils/requests/status'
import { toTableRoll, healingRolls, damageKinds } from '@/utils/table-view'
import type { RollRequestView, RollKind, GmRollView } from '@/types/roll'
import type { CommandResult, SpellSlotOp } from '@/types/sending-stone'
import type { HeldRollRequest } from '@/utils/requests/types'

/**
 * A roll as its player is told of it: where it stands, and what the game made of it. Of hit dice
 * spent at once, how many the game made, where it made some: all of them, where their player may
 * see them, or where it stopped part way, even where they can't; and where they can, what those it
 * made came to, all together, and gave back. Of an enchant activity used, or an enchantment ended,
 * what it applied and ended, seen or not; and of one that failed, whether no card of it is left.
 */
export function toRollRequestView(
  request: HeldRollRequest,
  now = Date.now(),
): RollRequestView {
  const status = rollStatus(request, now)
  const result = request.result as CommandResult | null
  const spent = result?.spent ? { spent: result.spent } : {}
  // What a move moved, from module 0.31.0: all of it, or what it moved before it failed.
  const moved = result?.transfer ? { transfer: result.transfer } : {}
  // What a removal removed, from module 0.33.0: when it was made, or where the item itself
  // changed before it failed.
  const removed = result?.removed ? { removed: result.removed } : {}
  // Whether a favorite added or removed is one now, from module 0.37.0, as the game says.
  const favorited =
    typeof result?.favorited === 'boolean'
      ? { favorited: result.favorited }
      : {}
  // What became of one of the character's own effects, from module 0.39.0, as the game says.
  const effect = result?.effect ? { effect: result.effect } : {}
  // What a Wild Shape command made, from module 0.40.0, as the game says: the form taken or left,
  // the form learned, or the Beasts to learn.
  const wildShape = result?.wildShape ? { wildShape: result.wildShape } : {}
  // What damage on its own that asked to spend spent, from module 0.41.0, as the game says, and
  // whether concentration began.
  const alone = result?.alone ? { alone: result.alone } : {}
  if (status === 'failed') {
    const reason = result?.reason ?? undefined
    if (!result?.spent || result.spent.made === 0) {
      return {
        id: request.id,
        status,
        reason,
        ...cardless(result),
        ...moved,
        ...removed,
        ...favorited,
        ...effect,
        ...wildShape,
        ...alone,
      }
    }
    if (!result.visible) {
      return {
        id: request.id,
        status,
        reason,
        visible: false,
        ...spent,
        ...moved,
        ...removed,
        ...favorited,
        ...effect,
        ...wildShape,
        ...alone,
      }
    }
    const rolls = result.rolls.map(roll => toTableRoll(roll))
    return {
      id: request.id,
      status,
      reason,
      visible: true,
      total: sumOf(rolls, request.kind),
      rolls,
      ...(typeof result.healed === 'number' ? { healed: result.healed } : {}),
      ...spent,
      ...moved,
      ...removed,
      ...favorited,
      ...effect,
      ...wildShape,
      ...alone,
    }
  }
  if (status !== 'done' || !result) return { id: request.id, status }
  // An attack's or a use's damage is the player's to roll, even of one they can't see; and what an
  // enchant activity did to their items is theirs to know.
  const damage = result.damage === undefined ? {} : { damage: result.damage }
  const use = result.use ? { use: result.use } : {}
  const enchantment = result.enchantment
    ? { enchantment: result.enchantment }
    : {}
  if (!result.visible)
    return {
      id: request.id,
      status,
      visible: false,
      ...use,
      ...damage,
      ...enchantment,
      ...moved,
      ...removed,
      ...favorited,
      ...effect,
      ...wildShape,
      ...alone,
    }
  const rolls = result.rolls.map(roll => toTableRoll(roll))
  return {
    id: request.id,
    status,
    visible: true,
    total: SUMMED.has(request.kind)
      ? sumOf(rolls, request.kind)
      : (rolls[0]?.total ?? undefined),
    rolls,
    ...(result.attack ? { attack: result.attack } : {}),
    ...(result.outcome ? { outcome: result.outcome } : {}),
    ...(typeof result.healed === 'number' ? { healed: result.healed } : {}),
    ...use,
    ...damage,
    ...enchantment,
    ...spent,
    ...moved,
    ...removed,
    ...favorited,
    ...effect,
    ...wildShape,
    ...alone,
  }
}

/**
 * What a roll of the Gamemaster's as a character is called on its player's page (#156) where their
 * page didn't say, as before it did: by its kind.
 */
const GM_ROLL_KINDS: Record<RollKind, string> = {
  skill: 'A check',
  ability: 'A check',
  tool: 'A check',
  save: 'A saving throw',
  death: 'A death saving throw',
  initiative: 'Initiative',
  attack: 'An attack',
  damage: 'Damage',
  use: 'A use',
  hitDie: 'Hit dice',
  hitDice: 'Hit dice',
  formula: 'A roll',
  textRoll: 'A roll',
  textDamage: 'Damage',
  itemDamage: 'Damage',
  recharge: 'A recharge',
  ask: 'A roll asked of the table',
  endEnchantment: 'An enchantment ended',
  endConcentration: 'Concentration ended',
  spend: 'Charges spent',
  inspiration: 'Heroic Inspiration',
  spellSlot: 'A spell slot spent or restored',
  transfer: 'Items or coins moved',
  remove: 'An item removed',
  favorite: 'A favorite added or removed',
  effect: 'An effect changed',
  wildShape: 'Wild Shape',
  prepare: 'A spell prepared or unprepared',
  endTurn: 'A turn ended',
  undoEndTurn: 'A turn taken back',
}

/** The rolls of a d20, whose first roll the game may say came up a critical or a fumble. */
const D20_KINDS: ReadonlySet<string> = new Set([
  'skill',
  'ability',
  'tool',
  'save',
  'death',
  'initiative',
  'attack',
])

/**
 * A roll the campaign's Gamemaster made as a character (#156), as its player is shown it beside
 * their own: what it's called, as the Gamemaster's page said, or else its kind; when it was sent;
 * and what the game made of it as the player is told of their own (`toRollRequestView`), hidden as
 * the game hid it, but none of its dice, and never the damage that follows an attack or a use,
 * which the Gamemaster rolls. A roll of a d20 the game made where its player may see it also says
 * whether the game called its first roll a critical or a fumble; and damage, whether it's healing,
 * as the game said of the attack or use it follows, or else of every roll it made of it, and
 * whether the game called it a critical hit's, where its player may see it.
 * @param request - Held with its label: text the Gamemaster's page sent, shown as no more.
 * @param heals - For damage, whether the game said healing follows the attack or use it follows.
 */
export function toGmRollView(
  request: HeldRollRequest & { label: string | null },
  now = Date.now(),
  heals = false,
): GmRollView {
  const view = toRollRequestView(request, now)
  const kind = request.kind as RollKind
  const first = view.visible ? view.rolls?.[0] : undefined
  let d20: GmRollView['d20']
  if (D20_KINDS.has(kind) && first?.critical) d20 = 'critical'
  else if (D20_KINDS.has(kind) && first?.fumble) d20 = 'fumble'
  const damage = DAMAGE_KINDS.has(kind)
  const healing = damage && (heals || healingRolls(view.rolls ?? []))
  const critical =
    damage && !!view.visible && !!view.rolls?.some(roll => roll.critical)
  const slotOp = kind === 'spellSlot' ? slotOpOf(request.payload) : undefined
  return {
    id: view.id,
    kind,
    label: request.label ?? GM_ROLL_KINDS[kind] ?? 'A roll',
    at: request.createdAt.toISOString(),
    status: view.status,
    ...(view.reason !== undefined && { reason: view.reason }),
    ...(view.visible !== undefined && { visible: view.visible }),
    ...(view.total !== undefined && { total: view.total }),
    ...(view.attack && { attack: view.attack }),
    ...(view.outcome && { outcome: view.outcome }),
    ...(view.healed !== undefined && { healed: view.healed }),
    ...(view.spent && { spent: view.spent }),
    ...(view.enchantment && { enchantment: view.enchantment }),
    ...(d20 && { d20 }),
    ...(critical && { critical }),
    ...(healing && { healing }),
    ...(slotOp && { slotOp }),
  }
}

/**
 * Whether a spell slot's request, from module 0.42.1, spent one or restored one, as held: for its
 * player's page to say which of the Gamemaster's it was. None where the payload doesn't say.
 */
function slotOpOf(payload: unknown): SpellSlotOp | undefined {
  const op = (payload as { spellSlot?: { op?: unknown } } | null)?.spellSlot?.op
  return SPELL_SLOT_OPS.find(each => each === op)
}

/**
 * Of a use of an enchant activity that failed, from module 0.21.0, whether the game names no card
 * of it, from which the Gamemaster could apply its enchantment: none was posted, as where a hook
 * stopped dnd5e's; it was deleted, as Midi deletes one it stops; or dnd5e lets no one apply it
 * from the card, as one naming a concentration that has since ended.
 */
function cardless(result: CommandResult | null): { card?: false } {
  const enchanting =
    result?.reason === 'enchant' || result?.use?.type === 'enchant'
  return enchanting && result?.messageId === null ? { card: false } : {}
}

/**
 * The rolls whose total is all of their rolls' added up: damage's parts, as dnd5e's card adds
 * damage up, or hit dice's cards.
 */
const SUMMED = new Set(['damage', 'textDamage', 'itemDamage', 'hitDice'])

/** The kinds that are damage or healing: from module 0.36.0, an action's on its own too. */
const DAMAGE_KINDS: ReadonlySet<string> = new Set([
  'damage',
  'textDamage',
  'itemDamage',
])

/**
 * Damage's total, or hit dice's, when the game said each of its rolls': hit dice's added up; and
 * damage's or healing's as dnd5e's card adds damage up: each kind's rolls together, each kind at
 * least 0, then every kind. Each roll's own total stays the game's.
 */
function sumOf(
  rolls: { total: number | null; damageType?: string }[],
  kind: string,
): number | undefined {
  if (rolls.length === 0 || rolls.some(roll => roll.total === null))
    return undefined
  if (!DAMAGE_KINDS.has(kind)) {
    return rolls.reduce((sum, roll) => sum + (roll.total ?? 0), 0)
  }
  // Each kind as the chat's damage card counts it, but every kind added, Midi-QOL's none and each
  // kind of healing too, as the table's total always has been.
  return damageKinds(rolls).reduce((sum, kind) => sum + (kind.total ?? 0), 0)
}
