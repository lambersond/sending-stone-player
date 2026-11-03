import prisma from '@/clients/prisma'
import { MIDI_PROMPT_WAIT, ROLL_ANSWER_WITHIN } from '@/constants/sending-stone'
import {
  applyJournalUpdated,
  drawJournal,
  reconcileJournals,
} from '@/db/note-sync'
import { groupRoster } from '@/db/party'
import {
  keepOnlySheetTexts,
  lacksSheetTexts,
  saveSheetTexts,
} from '@/db/sheet-texts'
import { companionRoster } from '@/utils/companions'
import { helloCampaignData, helloCompanionData } from '@/utils/hello-features'
import type { JournalDrawings, Tx } from '@/db/types'
import type { FoundrySettings, FoundrySnapshot } from '@/types/foundry-settings'
import type {
  CampaignRef,
  CharacterSheet,
  CombatantSummary,
  CombatSnapshot,
  CommandResult,
  CompanionEntry,
  CompanionUpdated,
  ConnectedCharacter,
  GamePrompt,
  GameEvent,
  SerializedMessage,
  GroupEntry,
  GroupSheet,
} from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// Every handler is idempotent. The module retries a post whose answer was lost with the same
// envelope, and only ever before sending the next one, so applying a duplicate again is harmless.

type World = { id: string; title: string }

/**
 * The events that leave the campaign's version alone: descriptions change nothing anyone sees
 * until a sheet refers to them, and Foundry's settings only the Gamemaster's campaign card shows,
 * which no table page watches. A journal of notes (module 0.34.0) has its own version, as no table
 * or party view shows notes.
 */
const VERSION_SILENT: ReadonlySet<string> = new Set([
  'character.texts',
  'bridge.settings',
  'journal.updated',
])

/**
 * Apply an event from a game's Gamemaster to what is held for one of its campaigns.
 * @param campaignId - The campaign, already found and its secret checked.
 * @param world - The Foundry world the event came from.
 * @param campaign - The campaign as the module named it, whose title may have changed.
 * @param event - The event, its payload already checked.
 * @param session - The module session that sent it.
 * @param sentAt - When the module sent it, by the game's clock: its envelope's `time`.
 * @returns Whether the campaign now lacks a description its sheets refer to, which the module
 * should send again with a hello.
 */
export async function applyCampaignEvent(
  campaignId: string,
  world: World,
  campaign: CampaignRef,
  event: GameEvent,
  session: string,
  sentAt: string,
): Promise<{ lacksTexts: boolean }> {
  // A journal's notes are drawn first: a large book's drawing would outlast the transaction.
  const drawings =
    event.type === 'journal.updated'
      ? await drawJournal(campaignId, event.data)
      : undefined
  return prisma.$transaction(async tx => {
    const lacksTexts = await apply(event, {
      tx,
      campaignId,
      session,
      sentAt,
      drawings,
    })
    const now = new Date()
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        // The Gamemaster can rename the campaign, and a game can switch worlds.
        title: campaign.title,
        worldId: world.id,
        worldTitle: world.title,
        ...(!VERSION_SILENT.has(event.type) && {
          version: { increment: 1 },
        }),
        lastEventAt: now,
        lastSeenAt: now,
        // The campaign's state is now this session's.
        ...(event.type === 'bridge.hello' && { helloSession: session }),
      },
    })
    return { lacksTexts }
  })
}

/** What an event's handler is given besides its payload. */
type Applying = {
  tx: Tx
  campaignId: string
  session: string
  sentAt: string
  drawings?: JournalDrawings
}

/** Each event type's payload, a type that shares its union member with others included. */
type EventData = {
  [T in GameEvent['type']]: (GameEvent & { type: T })['data']
}

/** Apply an event; true when the campaign then lacks a description its sheets refer to. */
async function apply<T extends GameEvent['type']>(
  event: { type: T; data: EventData[T] },
  applying: Applying,
): Promise<boolean> {
  const handler = EVENT_HANDLERS[event.type]
  return handler ? handler(event.data, applying) : false
}

/**
 * What each event does to what is held for its campaign, by type: true where the campaign then
 * lacks a description its sheets refer to. What became of a command and of a dish the events
 * route records itself, so neither is here.
 */
const EVENT_HANDLERS: {
  [T in GameEvent['type']]?: (
    data: EventData[T],
    applying: Applying,
  ) => Promise<boolean>
} = {
  'bridge.hello': (data, { tx, campaignId, sentAt }) =>
    applyHello(tx, campaignId, data, sentAt),
  'character.updated': async ({ character }, { tx, campaignId }) => {
    const { sheet } = character
    await saveCharacter(tx, campaignId, character)
    return sheet ? lacksSheetTexts(tx, campaignId, [sheet]) : false
  },
  'character.texts': async ({ texts }, { tx, campaignId }) => {
    await saveSheetTexts(tx, campaignId, texts)
    return false
  },
  'chat.message.created': keepMessage,
  'chat.message.updated': keepMessage,
  'chat.message.deleted': async ({ id }, { tx, campaignId }) => {
    await tx.chatMessage.deleteMany({ where: { campaignId, messageId: id } })
    return false
  },
  'chat.cleared': async (_, { tx, campaignId }) => {
    await tx.chatMessage.deleteMany({ where: { campaignId } })
    return false
  },
  'combat.ended': async ({ combat }, { tx, campaignId }) => {
    // The encounter ended, or the campaign's last character left it.
    await tx.combat.deleteMany({ where: { campaignId, combatId: combat.id } })
    return false
  },
  // combat.created also marks the campaign's first character joining a fight under way.
  'combat.created': keepCombat,
  'combat.started': keepCombat,
  'combat.turn': keepCombat,
  'combat.updated': keepCombat,
  'combat.combatant.added': keepCombatant,
  'combat.combatant.updated': keepCombatant,
  'combat.combatant.removed': async (
    { combatId, combatantId },
    { tx, campaignId },
  ) => {
    await patchCombat(tx, campaignId, combatId, combatants =>
      combatants.filter(({ id }) => id !== combatantId),
    )
    return false
  },
  'roll.prompt.opened': async ({ prompt }, { tx, campaignId, sentAt }) => {
    await savePrompt(tx, campaignId, prompt, sentAt)
    return false
  },
  'roll.prompt.closed': async ({ id, reason }, { tx, campaignId }) => {
    await closePrompt(tx, campaignId, id, reason)
    return false
  },
  'group.updated': async ({ group }, { tx, campaignId }) => {
    const { sheet } = group
    await saveGroup(tx, campaignId, group)
    return sheet ? lacksSheetTexts(tx, campaignId, [], [sheet]) : false
  },
  'group.removed': async ({ id }, { tx, campaignId }) => {
    await removeGroup(tx, campaignId, id)
    return false
  },
  'bridge.settings': async ({ settings }, { tx, campaignId, sentAt }) => {
    if (settings) {
      await saveFoundrySettings(tx, campaignId, settings, sentAt)
    }
    return false
  },
  'journal.updated': async (data, { tx, campaignId, drawings }) => {
    await applyJournalUpdated(tx, campaignId, data, drawings)
    return false
  },
  'companions.listed': async ({ companions }, { tx, campaignId }) => {
    await tx.campaign.update({
      where: { id: campaignId },
      data: { companions: companions.map(entry => toJson(entry)) },
    })
    await dropUnlistedCompanions(tx, campaignId, companions)
    return false
  },
  'companion.updated': (data, { tx, campaignId }) =>
    saveCompanion(tx, campaignId, data),
}

/**
 * A message posted or changed. An update is an upsert: a blind roll the Gamemaster reveals arrives
 * as one.
 */
async function keepMessage(
  { message }: EventData['chat.message.created'],
  { tx, campaignId, session }: Applying,
): Promise<boolean> {
  await saveMessage(tx, campaignId, message, session)
  return false
}

/** A combat made, started, turned or changed: its snapshot held, in place of any before. */
async function keepCombat(
  { combat }: EventData['combat.updated'],
  { tx, campaignId }: Applying,
): Promise<boolean> {
  await saveCombat(tx, campaignId, combat)
  return false
}

/** A combatant added to a held combat, or changed in it: put in its place in the turn order. */
async function keepCombatant(
  { combatId, combatant }: EventData['combat.combatant.updated'],
  { tx, campaignId }: Applying,
): Promise<boolean> {
  await patchCombat(tx, campaignId, combatId, combatants =>
    sortTurnOrder([
      ...combatants.filter(({ id }) => id !== combatant.id),
      combatant,
    ]),
  )
  return false
}

/**
 * Apply a hello: the campaign's full current state, its roster, its groups, what its game does,
 * its companions and what Foundry says of itself, replacing what was held; and the saves its game
 * is asking, its combats and its sheets. It carries no chat, so the chat log is kept.
 * @returns Whether the campaign then lacks a description its sheets refer to.
 */
async function applyHello(
  tx: Tx,
  campaignId: string,
  data: Extract<GameEvent, { type: 'bridge.hello' }>['data'],
  sentAt: string,
): Promise<boolean> {
  // The campaign's full current state. It carries no chat, so the chat log is kept.
  const { characters, features, prompts = [], groups = [] } = data
  // Its characters' companions, from module 0.36.0, whose sheets follow it; none from an
  // older module, which clears them.
  const { companions = [] } = data
  const { module, foundry, system, settings } = data
  const switches = helloCampaignData(features)
  const before = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { noteFeatures: true },
  })
  await tx.campaign.update({
    where: { id: campaignId },
    data: {
      characters: characters.map(character => rosterEntry(character)),
      // Its groups, from module 0.30.0, whose sheets follow it; none from an older module.
      groups: groups.map(group => groupRosterEntry(group)),
      ...switches,
      // Its characters' companions, from module 0.36.0, each as listed, never its sheet; and how
      // they roll (`helloCompanionData`).
      companions: companions.map(entry => toJson(entry)),
      ...helloCompanionData(features),
      // What Foundry says of itself, for the Gamemaster's card: replaced on every hello, so a
      // module before 0.30.0, which reports no settings, clears those an earlier one sent.
      foundry: toJson({
        receivedAt: sentAt,
        ...(module && { module }),
        ...(foundry && { foundry }),
        ...(system && { system }),
        ...(settings && { settings }),
      }),
    },
  })
  // The saves its game is asking for: any other still open has closed meanwhile.
  await tx.rollPrompt.updateMany({
    where: {
      campaignId,
      closedAt: null,
      promptId: { notIn: prompts.map(({ id }) => id) },
    },
    data: { closedAt: new Date(), closedReason: 'gone' },
  })
  for (const prompt of prompts) {
    await savePrompt(tx, campaignId, prompt, sentAt)
  }
  // Pages showing an order "kept here for now" learn that the game now takes it, or no longer
  // does: every book of the campaign is new where what the module does with notes changed.
  const noteFeatures = switches.noteFeatures.join(',')
  if (before && before.noteFeatures.join(',') !== noteFeatures) {
    await tx.journalBook.updateMany({
      where: { campaignId },
      data: { version: { increment: 1 } },
    })
  }
  // The books whose journal Foundry no longer has, from module 0.34.0, which lists those it
  // has; an older module lists none, and nothing is reconciled.
  if (features?.notes) {
    await reconcileJournals(
      tx,
      campaignId,
      characters.map(({ id }) => id),
      groups.map(({ id }) => id),
      features.notes.journals,
    )
  }
  await tx.combat.deleteMany({ where: { campaignId } })
  await tx.combat.createMany({
    data: data.combats.map(combat => ({
      campaignId,
      combatId: combat.id,
      data: toJson(combat),
    })),
  })
  // A group it no longer lists has left the campaign, with its sheet; those it lists keep
  // theirs until theirs follow.
  await tx.groupSheet.deleteMany({
    where: { campaignId, actorId: { notIn: groups.map(({ id }) => id) } },
  })
  // A companion it no longer lists has gone, with its sheet, before the descriptions kept are
  // counted, so that only those listed keep theirs (module 0.36.0).
  await dropUnlistedCompanions(tx, campaignId, companions)
  if (data.sheetsApart === true) {
    return keepRosterSheets(tx, campaignId, characters)
  }
  await tx.actorSheet.deleteMany({ where: { campaignId } })
  await tx.actorSheet.createMany({
    data: characters.flatMap(({ id, sheet }) =>
      sheet ? [{ campaignId, actorId: id, data: toJson(sheet) }] : [],
    ),
  })
  // Its descriptions came first; any no sheet refers to any more go, its companions' kept.
  const sheets = characters.flatMap(({ sheet }) => (sheet ? [sheet] : []))
  const companionSheets = await keptCompanionSheets(tx, campaignId)
  await keepOnlySheetTexts(tx, campaignId, sheets, [], companionSheets)
  return lacksSheetTexts(tx, campaignId, sheets, [], companionSheets)
}

/**
 * The sheets of the companions no longer listed go (module 0.36.0): those of every companion, for
 * a list of none, as from a module before 0.36.0.
 */
async function dropUnlistedCompanions(
  tx: Tx,
  campaignId: string,
  companions: CompanionEntry[],
) {
  await tx.companionSheet.deleteMany({
    where: { campaignId, key: { notIn: companions.map(({ key }) => key) } },
  })
}

/** The campaign's companions' sheets held, for the descriptions they refer to. */
async function keptCompanionSheets(
  tx: Tx,
  campaignId: string,
): Promise<CharacterSheet[]> {
  const kept = await tx.companionSheet.findMany({
    where: { campaignId },
    select: { data: true },
  })
  return kept.map(({ data }) => data as unknown as CharacterSheet)
}

/**
 * One of the campaign's characters' companions as it now stands (module 0.36.0), only where the
 * campaign lists it: its entry replaced, as the module sends it with its sheet, or why its sheet
 * was held back; and its sheet, kept apart from the characters', or none. A key not listed, as one
 * whose list hasn't come yet, is left alone: its sheet follows the list that names it.
 * @returns Whether the campaign lacks a description its sheet refers to.
 */
async function saveCompanion(
  tx: Tx,
  campaignId: string,
  { companion, sheet }: CompanionUpdated,
): Promise<boolean> {
  const held = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { companions: true },
  })
  const listed = companionRoster(held?.companions)
  if (!listed.some(({ key }) => key === companion.key)) return false
  await tx.campaign.update({
    where: { id: campaignId },
    data: {
      companions: listed.map(entry =>
        toJson(entry.key === companion.key ? companion : entry),
      ),
    },
  })
  const { key } = companion
  if (!sheet) {
    await tx.companionSheet.deleteMany({ where: { campaignId, key } })
    return false
  }
  const data = toJson(sheet)
  await tx.companionSheet.upsert({
    where: { campaignCompanion: { campaignId, key } },
    create: { campaignId, key, data },
    update: { data },
  })
  return lacksSheetTexts(tx, campaignId, [], [], [sheet])
}

/**
 * Foundry's settings for the campaign as they now stand, from module 0.30.0, which sends them when
 * one changes: kept with what its last hello said of Foundry's versions, as of when it sent them.
 */
async function saveFoundrySettings(
  tx: Tx,
  campaignId: string,
  settings: FoundrySettings,
  sentAt: string,
) {
  const held = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { foundry: true },
  })
  const kept = held?.foundry as FoundrySnapshot | null | undefined
  await tx.campaign.update({
    where: { id: campaignId },
    data: { foundry: toJson({ ...kept, settings, receivedAt: sentAt }) },
  })
}

/**
 * One of the campaign's characters as it now stands: its entry in the roster, replaced or added,
 * and its sheet.
 */
async function saveCharacter(
  tx: Tx,
  campaignId: string,
  character: ConnectedCharacter,
) {
  const held = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { characters: true },
  })
  const roster = (held?.characters ?? []) as unknown as ConnectedCharacter[]
  // Whether it enters its own dice's results is the hello's to say, from module 0.26.0: an update
  // that leaves it out keeps what the hello said.
  const said = roster.find(({ id }) => id === character.id)?.manualDice
  const entry = rosterEntry(
    character.manualDice === undefined && said !== undefined
      ? { ...character, manualDice: said }
      : character,
  )
  await tx.campaign.update({
    where: { id: campaignId },
    data: {
      characters: roster.some(({ id }) => id === character.id)
        ? roster.map(held => (held.id === character.id ? entry : held))
        : [...roster, entry],
    },
  })

  const actorId = character.id
  if (!character.sheet) {
    await tx.actorSheet.deleteMany({ where: { campaignId, actorId } })
    return
  }
  const data = toJson(character.sheet)
  await tx.actorSheet.upsert({
    where: { campaignActor: { campaignId, actorId } },
    create: { campaignId, actorId, data },
    update: { data },
  })
}

/**
 * The sheets held for a hello from module 0.22.0, whose characters carry none: each follows it in
 * a post of its own, after its descriptions. Until then, each of its characters keeps the sheet
 * held, a few seconds old, rather than none; one it no longer names has left, with its sheet. A
 * sheet missing from it is only on its way, so it never asks for everything again.
 * @returns That the campaign lacks no description, as it can't tell yet.
 */
async function keepRosterSheets(
  tx: Tx,
  campaignId: string,
  characters: ConnectedCharacter[],
): Promise<false> {
  await tx.actorSheet.deleteMany({
    where: { campaignId, actorId: { notIn: characters.map(({ id }) => id) } },
  })
  // Its descriptions come after it: those the sheets kept don't refer to go, its characters', its
  // groups' or, from module 0.36.0, its companions'.
  const [kept, keptGroups, keptCompanions] = await Promise.all([
    tx.actorSheet.findMany({ where: { campaignId }, select: { data: true } }),
    tx.groupSheet.findMany({ where: { campaignId }, select: { data: true } }),
    keptCompanionSheets(tx, campaignId),
  ])
  await keepOnlySheetTexts(
    tx,
    campaignId,
    kept.map(({ data }) => data as unknown as CharacterSheet),
    keptGroups.map(({ data }) => data as unknown as GroupSheet),
    keptCompanions,
  )
  return false
}

/**
 * One of the campaign's groups as it now stands (module 0.30.0): its entry in the roster, replaced
 * or added, with why its sheet was held back until an update without it; and its sheet, kept
 * apart from the characters', or none.
 */
async function saveGroup(
  tx: Tx,
  campaignId: string,
  group: GroupEntry & { sheet: GroupSheet | null },
) {
  const held = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { groups: true },
  })
  const roster = groupRoster(held?.groups)
  const entry = groupRosterEntry(group)
  await tx.campaign.update({
    where: { id: campaignId },
    data: {
      groups: roster.some(({ id }) => id === group.id)
        ? roster.map(listed =>
            listed.id === group.id ? entry : toJson(listed),
          )
        : [...roster.map(listed => toJson(listed)), entry],
    },
  })

  const actorId = group.id
  if (!group.sheet) {
    await tx.groupSheet.deleteMany({ where: { campaignId, actorId } })
    return
  }
  const data = toJson(group.sheet)
  await tx.groupSheet.upsert({
    where: { campaignGroup: { campaignId, actorId } },
    create: { campaignId, actorId, data },
    update: { data },
  })
}

/** A group deleted in Foundry (module 0.30.0): it leaves the roster, with its sheet. */
async function removeGroup(tx: Tx, campaignId: string, groupId: string) {
  const held = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { groups: true },
  })
  const roster = groupRoster(held?.groups)
  if (roster.some(({ id }) => id === groupId)) {
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        groups: roster
          .filter(({ id }) => id !== groupId)
          .map(entry => toJson(entry)),
      },
    })
  }
  await tx.groupSheet.deleteMany({ where: { campaignId, actorId: groupId } })
}

/** A group as the roster keeps it: everything but its sheet, which is kept on its own. */
function groupRosterEntry(group: GroupEntry & { sheet?: GroupSheet | null }) {
  const entry = { ...group }
  delete entry.sheet
  return toJson(entry)
}

/**
 * A character as the roster keeps it: everything but its sheet, which is kept on its own; such as
 * why its sheet was held back, until an update without it replaces it.
 */
function rosterEntry(character: ConnectedCharacter) {
  const entry = { ...character }
  delete entry.sheet
  return toJson(entry)
}

/**
 * A chat message as the module now serializes it, marked as made for the Gamemaster's roll as a
 * character (#156) where this app knows it was (`madeForGm`). Once marked, it stays marked,
 * whatever an edit later says.
 * @param session - The module session that sent it.
 */
async function saveMessage(
  tx: Tx,
  campaignId: string,
  message: SerializedMessage,
  session: string,
) {
  const fields = {
    sentAt: new Date(message.timestamp),
    public: message.audience.public,
    readers: message.audience.characters,
    data: toJson(message),
  }
  const byGm = await madeForGm(tx, campaignId, message, session)
  await tx.chatMessage.upsert({
    where: { campaignMessage: { campaignId, messageId: message.id } },
    create: { campaignId, messageId: message.id, ...fields, byGm },
    update: { ...fields, ...(byGm && { byGm: true }) },
  })
}

/**
 * Was a message made for the Gamemaster's roll as a character (#156)? Only where the roll it names
 * is one this app handed over as this campaign's Gamemaster's: the message's author, the
 * character's player, could write the claim, and copy a real one from a card of the Gamemaster's
 * they're the author of. From module 0.25.0, the roll's result lists the messages it made, so only
 * those listed are, whichever comes first: one that comes before the result is left for the result
 * to mark, where the session that sent it said in its hello that results list them. From an older
 * module, it's taken from what the message says, as the character that speaks it, while the roll
 * was being made: the module posts a roll's messages before what became of it, so they come while
 * it's being made; a little after counts too, as does any time after the module said it took too
 * long, when it may yet be made.
 * @param session - The module session that sent it.
 */
async function madeForGm(
  tx: Tx,
  campaignId: string,
  message: SerializedMessage,
  session: string,
): Promise<boolean> {
  const { gmRoll } = message
  if (!gmRoll) return false
  const [roll, campaign] = await Promise.all([
    tx.rollRequest.findFirst({
      where: { id: gmRoll, campaignId, role: 'gm' },
      select: { result: true },
    }),
    tx.campaign.findUnique({
      where: { id: campaignId },
      select: { helloSession: true, rollFeatures: true },
    }),
  ])
  const listed = (roll?.result as CommandResult | null | undefined)?.messages
  if (listed) return listed.includes(message.id)
  if (
    campaign?.helloSession === session &&
    campaign.rollFeatures.includes('gmRollMessages')
  ) {
    return false
  }
  const actorId = message.speaker.actorId
  return (
    !!actorId &&
    (await tx.rollRequest.count({
      where: {
        id: gmRoll,
        campaignId,
        role: 'gm',
        actorId,
        OR: [
          { status: 'claimed' },
          { completedAt: { gt: new Date(Date.now() - ROLL_ANSWER_WITHIN) } },
          { status: 'failed', result: { path: ['reason'], equals: 'timeout' } },
        ],
      },
    })) > 0
  )
}

/**
 * A save the game asks for, as the module now describes it. One that has closed stays closed: the
 * module never asks again on the same card; but from module 0.41.0, one closed as gone, as a hello
 * that leaves it out closes it, is opened again when the module lists or opens it again, as it
 * opens again a companion's it left out of a hello sent before the app's answer said it reads
 * them. What Midi-QOL asks waits a minute at most, by the game's clock, which may not be this
 * app's: it's held here as waiting, from when it came, what was left of its wait when it was sent,
 * so that its player is shown how long they have; and it's never moved by its later copies, as a
 * hello's. A hello may be the first to carry one, after it has waited a while, when the post that
 * opened it was lost. The time an envelope is sent is when the module queued it, so a post held up
 * in its queue isn't counted.
 * @param sentAt - When the module sent it, by the game's clock.
 */
async function savePrompt(
  tx: Tx,
  campaignId: string,
  prompt: GamePrompt,
  sentAt: string,
) {
  const fields = {
    actorId: prompt.actorId,
    data: toJson({
      type: prompt.type,
      abilities: prompt.abilities,
      skills: prompt.skills,
      dc: prompt.dc,
      label: prompt.label,
      messageId: prompt.messageId,
      source: prompt.source,
      advantage: prompt.advantage,
      askedInFoundry: prompt.askedInFoundry,
    }),
    openedAt: new Date(prompt.openedAt),
  }
  const expiresAt = new Date(prompt.expiresAt)
  // Where the envelope's time can't be read, or is before it opened, which one clock can't make
  // it, it's counted from when it opened: never longer than it was given.
  const openedAt = Date.parse(prompt.openedAt)
  const sent = Date.parse(sentAt)
  const from = Number.isNaN(sent) ? openedAt : Math.max(sent, openedAt)
  const left = expiresAt.getTime() - from
  // Gone, then listed or opened again: open again. Answered, rolled or expired stays closed.
  await tx.rollPrompt.updateMany({
    where: { campaignId, promptId: prompt.id, closedReason: 'gone' },
    data: { closedAt: null, closedReason: null },
  })
  await tx.rollPrompt.upsert({
    where: { campaignPrompt: { campaignId, promptId: prompt.id } },
    create: {
      campaignId,
      promptId: prompt.id,
      ...fields,
      expiresAt: prompt.source
        ? new Date(Date.now() + Math.max(0, Math.min(left, MIDI_PROMPT_WAIT)))
        : expiresAt,
    },
    update: prompt.source ? fields : { ...fields, expiresAt },
  })
}

/**
 * Close a save the game asked for, saying why, such as "answered": unless it closed already.
 * @returns Whether it was open.
 */
export async function closePrompt(
  tx: Tx,
  campaignId: string,
  promptId: string,
  reason: string,
): Promise<boolean> {
  const { count } = await tx.rollPrompt.updateMany({
    where: { campaignId, promptId, closedAt: null },
    data: { closedAt: new Date(), closedReason: reason },
  })
  return count > 0
}

async function saveCombat(tx: Tx, campaignId: string, combat: CombatSnapshot) {
  await tx.combat.upsert({
    where: { campaignCombat: { campaignId, combatId: combat.id } },
    create: { campaignId, combatId: combat.id, data: toJson(combat) },
    update: { data: toJson(combat) },
  })
}

/**
 * Change a held combat's combatants. A combat not held is left alone: the next snapshot of it,
 * which every turn change carries, brings it in.
 */
async function patchCombat(
  tx: Tx,
  campaignId: string,
  combatId: string,
  change: (combatants: CombatantSummary[]) => CombatantSummary[],
) {
  const held = await tx.combat.findUnique({
    where: { campaignCombat: { campaignId, combatId } },
    select: { data: true },
  })
  if (!held) return
  const combat = held.data as unknown as CombatSnapshot
  await saveCombat(tx, campaignId, {
    ...combat,
    combatants: change(combat.combatants),
  })
}

/**
 * Foundry's turn order: highest initiative first, those yet to roll last, then by name. The next
 * snapshot from Foundry corrects any difference, such as a system's own tiebreaker.
 */
export function sortTurnOrder(
  combatants: CombatantSummary[],
): CombatantSummary[] {
  return combatants.toSorted(
    (a, b) =>
      (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  )
}

const toJson = (value: object) => value as unknown as Prisma.InputJsonObject
