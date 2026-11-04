import { randomUUID } from 'node:crypto'
import prisma from '@/clients/prisma'
import { BRIDGE_SWITCHES } from '@/constants/features'
import { ANSWER_KINDS, OWN_KINDS, ROLL_KIND_INFO } from '@/constants/roll-kinds'
import {
  ASKS_PER_MINUTE,
  MOST_OPEN,
  OPEN_WITHIN,
  PLAYERS_PRESENT_FOR,
  PLAYERS_SEEN_EVERY,
  ROLL_PENDING_FOR,
  ROLLS_IN_FLIGHT,
  ROLLS_PER_MINUTE,
  TABLE_SEEN_EVERY,
} from '@/constants/sending-stone'
import { closePrompt } from '@/db/campaign-events'
import {
  ago,
  due,
  holdCommand,
  keptLabel,
  madeBy,
  onItsWay,
} from '@/db/commands'
import { FOUNDRY_ID } from '@/db/constants'
import { recordDishResult } from '@/db/cookbook'
import { createEffectRequest } from '@/db/effects'
import { createFavoriteRequest } from '@/db/favorites'
import { recordNoteResult } from '@/db/note-sync'
import { createRemoveRequest } from '@/db/removals'
import { createTransferRequest } from '@/db/transfers'
import { createWildShapeRequest, shapedRefusal } from '@/db/wild-shape'
import { sheetLinks } from '@/lib/sheet-html'
import { companionRoster } from '@/utils/companions'
import { changes } from '@/utils/damage-modifiers'
import { checkPrompt } from '@/utils/prompts'
import { availableRollKinds } from '@/utils/requests/availability'
import { checkDamage } from '@/utils/requests/check-damage'
import { checkEndTurn, checkUndoTurn } from '@/utils/requests/check-turns'
import { checkRoll } from '@/utils/requests/checks'
import { GM_UNSENT, toCommand } from '@/utils/requests/commands'
import { toRollRequestView } from '@/utils/requests/views'
import type {
  BridgePolled,
  BridgeSwitch,
  CommandCreator,
  RollRejection,
  RollSeat,
} from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type {
  RollKind,
  RollKindInfo,
  RollRequestInput,
  RollRequestView,
} from '@/types/roll'
import type {
  CharacterSheet,
  CombatSnapshot,
  CommandResult,
  ConnectedCharacter,
} from '@/types/sending-stone'
import type {
  HeldRollRequest,
  RollCommand,
  RollRefusal,
} from '@/utils/requests/types'
import type { Prisma } from '@prisma/client'

// A player's roll goes to the Gamemaster's game through the module, which fetches it. It is
// fetched at most once: a fetch whose answer is lost loses the roll rather than making it twice,
// which matters most for rolls that spend something, such as a spell slot.

/** The most rolls one fetch takes. */
const CLAIM_LIMIT = 10

/** What isn't a roll, each kind with a switch of its own, taken by its own creator. */
const OWN_CREATORS: Partial<Record<RollKind, CommandCreator>> = {
  transfer: createTransferRequest,
  remove: createRemoveRequest,
  favorite: createFavoriteRequest,
  effect: createEffectRequest,
  wildShape: createWildShapeRequest,
}

const heldSelect = {
  id: true,
  actorId: true,
  ofActorId: true,
  role: true,
  kind: true,
  payload: true,
  status: true,
  result: true,
  createdAt: true,
  claimedAt: true,
} as const

/**
 * Take a roll for a character to make in the Gamemaster's game, from its player or from the
 * campaign's Gamemaster as it (#156): if the game takes this kind of roll now, and the Gamemaster's
 * at all, the sheet allows it, and the seat isn't sending too many, nor asking the table too often.
 * One from a link in a description is checked against that description, as held here. A move of
 * items and coins, from module 0.31.0, is no roll, and has a switch of its own: it's checked by
 * `createTransferRequest` alone. A removal of an item, from module 0.33.0, likewise:
 * `createRemoveRequest` alone. A favorite added or removed, from module 0.37.0, likewise:
 * `createFavoriteRequest` alone, its player's only. One of the character's own effects turned off,
 * on or deleted, from module 0.39.0, likewise: `createEffectRequest` alone, its player's only. Wild
 * Shape, from module 0.40.0, likewise: `createWildShapeRequest` alone, its player's only. And from
 * module 0.40.0, while the character is transformed, as its sheet says, a favorite, an effect, a
 * removal, or a move with a transformed character at either end, waits until it's back in its own
 * form (`shapedRefusal`), before each kind's own checks. From module 0.36.0, at a companion's seat:
 * of the kinds the game takes for companions, never a move, a removal, from module 0.37.0 a
 * favorite, which a companion has none of, from module 0.39.0 a change to its effects, or from
 * module 0.40.0 Wild Shape, nor an answer to what the game asks, which it asks of no companion
 * before module 0.41.0, which says `companionPrompts`; a death saving throw only where it's an
 * important NPC; and its initiative not where it acts right after its character, who's in that
 * combat. It's checked against its own sheet, typed in as its character's player types theirs,
 * and kept as its key, with its character's id, for the module to make it as the companion. And a
 * turn ended, from module 0.36.0, only by the character's player at its own seat, never at a
 * companion's or the Gamemaster's, is checked against the combat it names alone, as last heard
 * of, with or without a sheet, and counted with the seat's rolls; and so is a turn ended taken
 * back, only from the seat that ended it, and only for a moment after (`checkUndoTurn`). From
 * module 0.41.0, damage on its own names its slot, attack mode or ammunition, or spends what its
 * use would, only where the game takes them (`aloneChoices`).
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The roll's id, or why it wasn't taken.
 */
export async function createRollRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  // A companion's seat moves, removes, favorites, changes no effects and uses no Wild Shape: it has
  // no items of the character's to move, nor favorites, its effects are no player's to change, it
  // has no Wild Shape of a character's, and the schema takes the kinds, so they're refused here
  // first, before any is looked at.
  const { companion } = seat
  if (companion && OWN_KINDS.includes(input.kind)) {
    return { status: 422, reason: 'unknown' }
  }
  // While the character is transformed, what would change its own actor's things waits.
  if ('shaped' in ROLL_KIND_INFO[input.kind]) {
    const shaped = await shapedRefusal(seat, input)
    if (shaped) return shaped
  }
  const own = OWN_CREATORS[input.kind]
  if (own) return own(seat, input)
  const { campaignId, actorId } = seat
  if (!campaignId || !actorId) return { status: 409, reason: 'unavailable' }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: ROLL_CAMPAIGN,
  })
  const gated = rollGate(seat, input, campaign)
  if (gated || !campaign) return gated ?? { status: 409, reason: 'unavailable' }

  const now = Date.now()
  const context = await readRollContext(seat, input, campaignId, actorId, now)
  const { inFlight, lastMinute, asks } = context
  if (
    inFlight >= ROLLS_IN_FLIGHT ||
    lastMinute >= ROLLS_PER_MINUTE ||
    asks >= ASKS_PER_MINUTE
  ) {
    return { status: 429, reason: 'busy' }
  }
  const refusal = rollRefusal(companion, input, campaign, context)
  if (refusal) return { status: 422, reason: refusal }

  // What it's called is the app's alone: the module is sent only what to roll. The Gamemaster's is
  // kept, for the character's player to be shown it by; a player's own page never asks for theirs.
  const { label } = input
  return holdCommand(
    seat,
    {
      campaignId,
      actorId,
      // A companion's, made as it, names its character (module 0.36.0).
      ...(companion && { ofActorId: companion.of }),
      kind: input.kind,
      ...keptLabel(seat, label),
      payload: rollPayload(
        seat,
        input,
        campaign,
      ) as unknown as Prisma.InputJsonValue,
      useId: context.damage,
    },
    now,
  )
}

/** What a roll reads of its campaign: whether the game takes it, how, and its roster. */
const ROLL_CAMPAIGN = {
  rollsEnabled: true,
  rollKinds: true,
  rollFeatures: true,
  bridgePolledAt: true,
  characters: true,
  companions: true,
  companionKinds: true,
  companionInitiative: true,
} as const satisfies Prisma.CampaignSelect

/** A roll's campaign, as ROLL_CAMPAIGN reads it. */
type RollCampaign = Prisma.CampaignGetPayload<{ select: typeof ROLL_CAMPAIGN }>

/**
 * Whether the game takes this roll now, before anything else is read: the Gamemaster's only where
 * it makes them as the character's, its kind where the game takes it, a companion's only of the
 * kinds the game takes for companions, and whatever it asks of the game only where the game does
 * that.
 * @returns Why not; nothing where it does.
 */
function rollGate(
  seat: SheetSeat,
  input: RollRequestInput,
  campaign: RollCampaign | null,
): RollRejection | undefined {
  const { companion } = seat
  // The Gamemaster's rolls go only to a game that makes them as the character's, marked as theirs;
  // and ending an enchantment, a concentration or from module 0.36.0 a turn, or taking one back, is
  // no roll, and posts nothing, so it would leave no mark: the Gamemaster ends one in Foundry.
  // Charges spent and Heroic Inspiration post a line marked as theirs, so they're the Gamemaster's
  // to send too.
  if (
    seat.role === 'gm' &&
    (!campaign?.rollFeatures.includes('gmRolls') || GM_UNSENT.has(input.kind))
  ) {
    return { status: 409, reason: 'unavailable' }
  }
  if (!campaign || !availableRollKinds(campaign).includes(input.kind)) {
    return { status: 409, reason: 'unavailable' }
  }
  // A companion's rolls are only those the game takes for companions, as its view offers them.
  if (companion && !campaign.companionKinds.includes(input.kind)) {
    return { status: 409, reason: 'unavailable' }
  }
  // The game asks a companion its saves only from module 0.41.0, and only an important NPC makes
  // death saving throws.
  if (
    companion &&
    input.prompt &&
    !campaign.rollFeatures.includes('companionPrompts')
  ) {
    return { status: 422, reason: 'prompt' }
  }
  if (lacksFeature(input, campaign.rollFeatures)) {
    return { status: 409, reason: 'unavailable' }
  }
  return undefined
}

/**
 * Whether a roll asks the game for what it doesn't do: damage a player changed goes only to a game
 * that can roll it so, an answer to what the game asked only to one that asks, an area attack only
 * to one that makes it at those picked, a check an activity asks for only to one that makes it
 * against the activity, and from module 0.41.0 damage on its own with its choices, or spending
 * what it uses, only to one that takes them.
 */
function lacksFeature(input: RollRequestInput, features: string[]): boolean {
  return (
    (changes(input.modifiers) && !features.includes('modifiers')) ||
    (input.kind === 'itemDamage' &&
      namesAloneChoices(input) &&
      !features.includes('aloneChoices')) ||
    (!!input.prompt && !features.includes('prompts')) ||
    (input.kind === 'attack' &&
      input.targets !== undefined &&
      !features.includes('areaAttacks')) ||
    ('check' in ROLL_KIND_INFO[input.kind] &&
      input.item !== undefined &&
      !features.includes('activityChecks'))
  )
}

/**
 * What a roll is checked against, read at once: its sheet, its combat, for damage the attack or use
 * it follows and what else followed it, the seat's rolls on their way and of the last minute, what
 * the game asked and its answers so far, the description a link was in, the seat's asks of the
 * last minute, and for a turn taken back, the End Turn it names.
 */
async function readRollContext(
  seat: SheetSeat,
  input: RollRequestInput,
  campaignId: string,
  actorId: string,
  now: number,
) {
  const { companion } = seat
  const damage = input.kind === 'damage' && input.use ? input.use : undefined
  const undoing = input.kind === 'undoEndTurn'
  const combatId = combatOf(input)
  const prompt = input.prompt
  const text = input.text
  const [
    sheet,
    combats,
    use,
    others,
    inFlight,
    lastMinute,
    asked,
    answers,
    described,
    asks,
    ended,
  ] = await Promise.all([
    // A companion's own sheet, kept apart from the characters'.
    companion
      ? prisma.companionSheet.findUnique({
          where: { campaignCompanion: { campaignId, key: actorId } },
          select: { data: true },
        })
      : prisma.actorSheet.findUnique({
          where: { campaignActor: { campaignId, actorId } },
          select: { data: true },
        }),
    combatId
      ? prisma.combat.findMany({
          where: { campaignId, combatId },
          select: { data: true },
        })
      : [],
    damage
      ? prisma.rollRequest.findFirst({
          where: { id: damage, ...madeBy(seat) },
          select: heldSelect,
        })
      : undefined,
    damage
      ? prisma.rollRequest.findMany({
          where: { useId: damage, ...madeBy(seat) },
          select: { status: true, createdAt: true, claimedAt: true },
        })
      : [],
    prisma.rollRequest.count({
      where: { ...madeBy(seat), ...onItsWay(now) },
    }),
    prisma.rollRequest.count({
      where: {
        ...madeBy(seat),
        createdAt: { gt: ago(now, 60_000) },
      },
    }),
    prompt
      ? prisma.rollPrompt.findUnique({
          where: { campaignPrompt: { campaignId, promptId: prompt } },
          select: {
            actorId: true,
            data: true,
            expiresAt: true,
            closedAt: true,
          },
        })
      : undefined,
    // Either seat's answer: the first, its player's or the Gamemaster's, answers it; a saving
    // throw, or what Midi-QOL asks may be, an ability or skill check.
    prompt
      ? prisma.rollRequest.findMany({
          where: {
            campaignId,
            actorId,
            kind: { in: [...ANSWER_KINDS] },
            payload: { path: ['prompt'], equals: prompt },
          },
          select: { status: true, createdAt: true, claimedAt: true },
        })
      : [],
    text
      ? prisma.sheetText.findUnique({
          where: { campaignHash: { campaignId, hash: text } },
          select: { html: true },
        })
      : undefined,
    // Asks the game made, or may yet make.
    input.kind === 'ask'
      ? prisma.rollRequest.count({
          where: {
            ...madeBy(seat),
            kind: 'ask',
            status: { in: ['pending', 'claimed', 'done'] },
            createdAt: { gt: ago(now, 60_000) },
          },
        })
      : 0,
    // The End Turn a turn taken back names: only this seat's, for this character. '' matches no
    // row, should it name none.
    undoing
      ? prisma.rollRequest.findFirst({
          where: {
            id: input.undo ?? '',
            kind: 'endTurn',
            actorId,
            ...madeBy(seat),
          },
          select: { status: true, completedAt: true, payload: true },
        })
      : undefined,
  ])
  return {
    actorId,
    now,
    damage,
    undoing,
    ending: input.kind === 'endTurn' || undoing,
    sheet: sheet?.data as unknown as CharacterSheet | undefined,
    fights: combats.map(({ data }) => data as unknown as CombatSnapshot),
    use,
    others,
    inFlight,
    lastMinute,
    asked,
    answers,
    described,
    asks,
    ended,
  }
}

/**
 * Why the character can't make this roll, as its sheet and combat say. A turn ended, from module
 * 0.36.0, is checked against the combat alone, with a sheet or none: the turn the page was shown,
 * still the current one, and the character's or a companion's. One taken back, against the End
 * Turn it names too, and the combat where that left it.
 */
function rollRefusal(
  companion: SheetSeat['companion'],
  input: RollRequestInput,
  campaign: RollCampaign,
  context: Awaited<ReturnType<typeof readRollContext>>,
): RollRefusal | undefined {
  const { actorId, now, sheet, fights } = context
  if (context.undoing) {
    return checkUndoTurn(
      input.turn,
      context.ended,
      fights,
      actorId,
      companionRoster(campaign.companions),
      now,
    )
  }
  if (context.ending) {
    return checkEndTurn(
      input.turn,
      fights,
      actorId,
      companionRoster(campaign.companions),
    )
  }
  if (context.damage) {
    return checkDamage(input, context.use, context.others, now, actorId)
  }
  return (
    companionRefusal(input, companion, sheet, fights, campaign) ??
    checkRoll(
      input,
      sheet,
      fights,
      actorId,
      context.described ? sheetLinks(context.described.html) : undefined,
      campaign.rollFeatures,
    ) ??
    (input.prompt
      ? checkPrompt(input, context.asked, actorId, context.answers, now)
      : undefined)
  )
}

/**
 * The combat a roll is made in: initiative's, or the one an attack's or a use's targets are in; or
 * from module 0.36.0, the one whose turn is ended, or taken back.
 */
function combatOf(input: RollRequestInput): string | undefined {
  if (input.kind === 'initiative') return input.combatId
  if (input.kind === 'endTurn' || input.kind === 'undoEndTurn') {
    return input.turn?.combatId
  }
  return input.target?.combatId ?? input.targets?.[0]?.combatId
}

/**
 * What the module is sent of a roll: only what to roll, as its label is the app's alone. Marked as
 * typed in only where the player may type theirs, as the game said last: else the same dice,
 * unmarked. A companion's are typed as its character's are. And with it, the dice its effects add,
 * and that its rerolls are its player's, where the game takes them (module 0.42.0); else the game
 * rolls those.
 */
function rollPayload(
  seat: SheetSeat,
  input: RollRequestInput,
  campaign: RollCampaign,
) {
  const { typed, effectDice, rerolls } = input
  const command = { ...input }
  delete command.label
  delete command.typed
  delete command.effectDice
  delete command.rerolls
  const roster = campaign.characters as unknown as ConnectedCharacter[]
  const typer = seat.companion?.of ?? seat.actorId
  const typedHere =
    typed === true &&
    seat.role === 'player' &&
    command.dice.length > 0 &&
    campaign.rollFeatures.includes('manualDice') &&
    roster.some(({ id, manualDice }) => id === typer && manualDice === true)
  return typedHere
    ? {
        ...command,
        typed: true as const,
        ...(effectDice &&
          effectDice.length > 0 &&
          campaign.rollFeatures.includes('effectDice') && { effectDice }),
        ...(rerolls === 'kept' &&
          campaign.rollFeatures.includes('keptRerolls') && { rerolls }),
      }
    : command
}

/**
 * Does damage on its own name any of its choices, from module 0.41.0: the slot it's rolled at, the
 * attack mode, the ammunition, or spending what its use would?
 */
function namesAloneChoices(input: RollRequestInput): boolean {
  return (
    input.slot !== undefined ||
    input.attackMode !== undefined ||
    input.ammunition !== undefined ||
    input.consume !== undefined
  )
}

/**
 * Why a companion can't make this roll, from module 0.36.0, before it's checked as any roll is: a
 * death saving throw of a creature that makes none, as only an important NPC does; or its
 * initiative where its campaign has companions act right after their character and one of its
 * characters is a combatant of that combat, whose initiative the game sets for it. Nothing for a
 * character's own roll.
 */
function companionRefusal(
  input: RollRequestInput,
  companion: SheetSeat['companion'],
  sheet: CharacterSheet | undefined,
  combats: CombatSnapshot[],
  campaign: { companionInitiative: string },
): RollRefusal | undefined {
  if (!companion) return undefined
  if (input.kind === 'death' && sheet?.creature?.important !== true) {
    return 'not-dying'
  }
  if (input.kind === 'initiative' && campaign.companionInitiative === 'after') {
    const combat = combats.find(({ id }) => id === input.combatId)
    const follows = combat?.combatants.some(
      ({ character }) => !!character && companion.entry.of.includes(character),
    )
    if (follows) return 'follows'
  }
  return undefined
}

/**
 * A roll a seat sent, as it is told of it. At a companion's, from module 0.36.0, only one the seat
 * sent for that companion from that character's seat: never the character's own, nor another
 * companion's, which a player's rolls, all kept by their Character, would otherwise match.
 * @returns Undefined for a roll that isn't the seat's: another character's, or the other seat's.
 */
export async function getRollRequestView(
  seat: RollSeat,
  requestId: string,
): Promise<RollRequestView | undefined> {
  const request = await prisma.rollRequest.findFirst({
    where: {
      id: requestId,
      ...madeBy(seat),
      ...(seat.companion && {
        actorId: seat.actorId ?? '',
        ofActorId: seat.companion.of,
      }),
    },
    select: heldSelect,
  })
  return request ? toRollRequestView(request as HeldRollRequest) : undefined
}

/**
 * Hand the module the rolls waiting for its game, oldest first, marking them fetched. Two fetches
 * at once, as from a Gamemaster's two tabs, never take the same roll: only rows still waiting are
 * marked, and each fetch returns only the rows it marked. The Gamemaster's rolls as a character
 * (#156) go only to the session whose hello said it makes them, `gmRolls`, and only those of the
 * campaign's owner: a module before 0.23.0 would make them unmarked, as the player's. Others stay
 * waiting, and run out. From module 0.31.0, a move of items or coins goes only to the session whose
 * hello said it takes them, the Gamemaster's as a player's. From module 0.33.0, a removal likewise,
 * only to the session whose hello said it takes them. From module 0.37.0, a favorite likewise, a
 * player's only. From module 0.39.0, a change to a character's own effects likewise, a player's
 * only, to the session whose hello said its campaign lets them. From module 0.40.0, Wild Shape
 * likewise, a player's only, to the session whose hello said its campaign lets them.
 * @param session - The module session that fetched them.
 */
export async function claimRollRequests(
  campaignId: string,
  session: string,
): Promise<RollCommand[]> {
  const now = Date.now()
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      helloSession: true,
      rollFeatures: true,
      ownerId: true,
      transfersEnabled: true,
      removalsEnabled: true,
      favoritesEnabled: true,
      effectsEnabled: true,
      wildShapeEnabled: true,
    },
  })
  const ownerId = campaign?.ownerId
  const current = campaign?.helloSession === session
  const gmRolls =
    !!ownerId && current && campaign.rollFeatures.includes('gmRolls')
  // Moves go only to the session whose hello said it takes them, and the Gamemaster's need no
  // `gmRolls`, which the module says only while rolls are on. Removals, from module 0.33.0, as
  // moves do. Favorites, from module 0.37.0, as removals, but a player's alone: no Gamemaster's is
  // ever taken, so none is handed over. A character's own effects changed, from module 0.39.0, as
  // favorites, by the campaign's own switch; and Wild Shape, from module 0.40.0, likewise, so a
  // module before it, which says nothing of it, is never handed one.
  const takes = (kind: RollKind) => {
    const field = (ROLL_KIND_INFO[kind] as RollKindInfo).own
    return current && !!field && campaign?.[field] === true
  }
  const transfers = takes('transfer')
  const removals = takes('remove')
  // A row of a kind the session doesn't take now waits, and runs out.
  const withheld = OWN_KINDS.filter(kind => !takes(kind))
  const notWithheld = withheld.length > 0 ? { kind: { notIn: withheld } } : {}
  const notOwn = { kind: { notIn: [...OWN_KINDS] } }
  const waiting = await prisma.rollRequest.findMany({
    where: {
      campaignId,
      status: 'pending',
      createdAt: { gt: ago(now, ROLL_PENDING_FOR) },
      OR: [
        { role: 'player', ...notWithheld },
        ...(gmRolls
          ? [{ role: 'gm' as const, requestedById: ownerId, ...notOwn }]
          : []),
        ...(transfers && ownerId
          ? [{ role: 'gm' as const, requestedById: ownerId, kind: 'transfer' }]
          : []),
        ...(removals && ownerId
          ? [{ role: 'gm' as const, requestedById: ownerId, kind: 'remove' }]
          : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: CLAIM_LIMIT,
    select: { id: true },
  })
  if (waiting.length === 0) return []
  const claimToken = randomUUID()
  const ids = waiting.map(({ id }) => id)
  await prisma.rollRequest.updateMany({
    where: { id: { in: ids }, status: 'pending' },
    data: {
      status: 'claimed',
      claimToken,
      claimSession: session,
      claimedAt: new Date(now),
    },
  })
  const claimed = await prisma.rollRequest.findMany({
    where: { id: { in: ids }, claimToken },
    orderBy: { createdAt: 'asc' },
    select: heldSelect,
  })
  return claimed.map(request => toCommand(request as HeldRollRequest))
}

/**
 * Record what became of a roll the module fetched. An answer for a roll already answered, or
 * another campaign's, changes nothing; one that comes after its player was told it was lost still
 * counts, as does one saying it was made after all, once the module had said it took too long, or
 * of hit dice spent at once, that some of them were before it stopped. A save that answered what
 * the game asked, or found it no longer waits, closes it. The chat messages the Gamemaster's roll
 * as a character made (#156), which the module lists from 0.25.0, are marked as theirs: those
 * held already now, and any yet to come as they come.
 */
export async function recordCommandResult(
  campaignId: string,
  result: CommandResult,
): Promise<void> {
  // A dish from the Magical Recipe Book, from module 0.38.0, is no roll: its prefix says so.
  if (result.id.startsWith('dish-')) return recordDishResult(campaignId, result)
  const made = result.status === 'done'
  // Late, but made after all, or some of them.
  const late = made || (result.spent?.made ?? 0) > 0
  const { count } = await prisma.rollRequest.updateMany({
    where: {
      id: result.id,
      campaignId,
      OR: [
        { status: 'claimed' },
        ...(late
          ? [
              {
                status: 'failed' as const,
                result: { path: ['reason'], equals: 'timeout' },
              },
            ]
          : []),
      ],
    },
    data: {
      status: result.status,
      result: result as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  })
  // No roll of that id: from module 0.34.0, a note command's, which is no roll.
  if (count === 0) return recordNoteResult(campaignId, result)
  await recordRollResult(campaignId, result)
}

/**
 * What a roll's result, once recorded, marks: the chat messages the Gamemaster's roll made as
 * theirs, and what the game asked that a save answered, closed. The campaign's pages are told only
 * when that changes what they show.
 */
async function recordRollResult(
  campaignId: string,
  result: CommandResult,
): Promise<void> {
  const listed = result.messages ?? []
  const answers = result.status === 'done' || result.reason === 'prompt'
  if (!answers && listed.length === 0) return
  const request = await prisma.rollRequest.findFirst({
    where: { id: result.id, campaignId },
    select: { payload: true, role: true },
  })
  const marked = await markGmMessages(campaignId, request?.role, listed)
  const closed =
    answers && (await closeAnsweredPrompt(campaignId, request?.payload, result))
  if (marked || closed) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    })
  }
}

/**
 * Mark as the Gamemaster's the chat messages the module said a roll handed over as theirs made;
 * never a player's.
 * @returns Whether any was marked.
 */
async function markGmMessages(
  campaignId: string,
  role: string | undefined,
  listed: string[],
): Promise<boolean> {
  if (role !== 'gm' || listed.length === 0) return false
  const marked = await prisma.chatMessage.updateMany({
    where: { campaignId, messageId: { in: listed }, byGm: false },
    data: { byGm: true },
  })
  return marked.count > 0
}

/**
 * Close what the game asked that a roll answered: made, or found to wait no longer.
 * @returns Whether it closed.
 */
async function closeAnsweredPrompt(
  campaignId: string,
  payload: Prisma.JsonValue | undefined,
  result: CommandResult,
): Promise<boolean> {
  const prompt = (payload as RollRequestInput | null | undefined)?.prompt
  const reason =
    result.status === 'done' ? 'answered' : (result.error ?? 'gone')
  return !!prompt && closePrompt(prisma, campaignId, prompt, reason)
}

/**
 * Note that the module is fetching players' rolls, which also says its game is connected.
 * @returns Whether the campaign takes players' rolls, from module 0.31.0 their moves of items and
 * coins, from module 0.33.0 removals of their characters' items, from module 0.34.0 journal
 * notes, from module 0.37.0 their characters' favorites, from module 0.38.0 dishes from the
 * Magical Recipe Book, from module 0.39.0 changes to their characters' own effects, and from
 * module 0.40.0 Wild Shape, and whether any of its players have their table open, so that one may
 * be coming.
 */
export async function markBridgePolled(
  campaignId: string,
): Promise<BridgePolled> {
  const now = new Date()
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { bridgePolledAt: now, lastSeenAt: now },
    select: {
      ...(Object.fromEntries(
        BRIDGE_SWITCHES.map(field => [field, true]),
      ) as Record<BridgeSwitch, true>),
      playersSeenAt: true,
    },
  })
  const seen = campaign.playersSeenAt?.getTime()
  return {
    ...(Object.fromEntries(
      BRIDGE_SWITCHES.map(field => [field, campaign[field]]),
    ) as Record<BridgeSwitch, boolean>),
    playersPresent: !!seen && now.getTime() - seen < PLAYERS_PRESENT_FOR,
  }
}

/** When this server last noted each campaign's players present. */
const noted = new Map<string, number>()

/**
 * Note that one of a campaign's players has their table open, so the module's fetches are held
 * open for their rolls. Written at most once every half minute.
 */
export async function notePlayersSeen(campaignId: string): Promise<void> {
  const now = Date.now()
  if (!due(noted, campaignId, PLAYERS_SEEN_EVERY, now)) return
  await prisma.campaign.updateMany({
    where: {
      id: campaignId,
      OR: [
        // Prisma's filter for an unset field.
        { playersSeenAt: null },
        { playersSeenAt: { lt: ago(now, PLAYERS_SEEN_EVERY) } },
      ],
    },
    data: { playersSeenAt: new Date(now) },
  })
}

/** When this server last noted each character's table open. */
const tablesNoted = new Map<string, number>()

/**
 * Note that a player has their character's table open, so that the module waits for their answers
 * to what Midi-QOL asks of it (module 0.27.0). Written at most once every few seconds, in the
 * database, as the module's fetches that read it may be answered by another of this app's servers.
 * @param characterId - The player's character; never the Gamemaster's seat, which has none.
 */
export async function noteTableOpen(characterId: string): Promise<void> {
  const now = Date.now()
  if (!due(tablesNoted, characterId, TABLE_SEEN_EVERY, now)) return
  await prisma.character.updateMany({
    where: {
      id: characterId,
      OR: [
        // Prisma's filter for an unset field.
        { tableSeenAt: null },
        { tableSeenAt: { lt: ago(now, TABLE_SEEN_EVERY) } },
      ],
    },
    data: { tableSeenAt: new Date(now) },
  })
}

/**
 * The campaign's characters open in the app now, by their actors' ids, sorted: those whose
 * player's page asked for their table lately. The module waits only for their answers.
 */
export async function openActorIds(campaignId: string): Promise<string[]> {
  const characters = await prisma.character.findMany({
    where: {
      campaignId,
      actorId: { not: null },
      tableSeenAt: { gt: ago(Date.now(), OPEN_WITHIN) },
    },
    orderBy: { actorId: 'asc' },
    take: MOST_OPEN,
    select: { actorId: true },
  })
  const ids = characters.flatMap(({ actorId }) =>
    actorId && FOUNDRY_ID.test(actorId) ? [actorId] : [],
  )
  return [...new Set(ids)]
}
