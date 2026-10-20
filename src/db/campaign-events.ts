import prisma from '@/clients/prisma'
import {
  MIDI_PROMPT_WAIT,
  ROLL_ANSWER_WITHIN,
  ROLL_KINDS,
} from '@/constants/sending-stone'
import { groupRoster } from '@/db/party'
import {
  keepOnlySheetTexts,
  lacksSheetTexts,
  saveSheetTexts,
} from '@/db/sheet-texts'
import type { FoundrySettings, FoundrySnapshot } from '@/types/foundry-settings'
import type { GroupEntry, GroupSheet } from '@/types/party'
import type {
  CampaignRef,
  CharacterSheet,
  CombatantSummary,
  CombatSnapshot,
  CommandResult,
  ConnectedCharacter,
  GamePrompt,
  GameEvent,
  SerializedMessage,
} from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// Every handler is idempotent. The module retries a post whose answer was lost with the same
// envelope, and only ever before sending the next one, so applying a duplicate again is harmless.

type Tx = Prisma.TransactionClient
type World = { id: string; title: string }

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
  return prisma.$transaction(async tx => {
    const lacksTexts = await apply(tx, campaignId, event, session, sentAt)
    const now = new Date()
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        // The Gamemaster can rename the campaign, and a game can switch worlds.
        title: campaign.title,
        worldId: world.id,
        worldTitle: world.title,
        // Descriptions change nothing anyone sees until a sheet refers to them, and Foundry's
        // settings only the Gamemaster's campaign card shows, which no table page watches.
        ...(!['character.texts', 'bridge.settings'].includes(event.type) && {
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

/** Apply an event; true when the campaign then lacks a description its sheets refer to. */
async function apply(
  tx: Tx,
  campaignId: string,
  event: GameEvent,
  session: string,
  sentAt: string,
): Promise<boolean> {
  switch (event.type) {
    case 'bridge.hello': {
      // The campaign's full current state. It carries no chat, so the chat log is kept.
      const { characters, features, prompts = [], groups = [] } = event.data
      const { module, foundry, system, settings } = event.data
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          characters: characters.map(character => rosterEntry(character)),
          // Its groups, from module 0.30.0, whose sheets follow it; none from an older module.
          groups: groups.map(group => groupRosterEntry(group)),
          // Whether its players may roll in the game from here. A module before 0.10.0 can't
          // make their rolls, and says nothing of them.
          rollsEnabled: features?.rolls?.enabled === true,
          // A move of items and coins is never one of the rolls, even where a module says so: it
          // has a switch of its own.
          rollKinds: (features?.rolls?.kinds ?? []).filter(
            kind =>
              (ROLL_KINDS as readonly string[]).includes(kind) &&
              kind !== 'transfer',
          ),
          // What else it can do with them: from module 0.13.0, take damage a player changed, and
          // ask players for the saves their game asks of them; from module 0.16.0, make area
          // attacks at the combatants players pick; from module 0.21.0, make a check an activity
          // asks for, the player's own, against it, and change a description's damage only on a
          // die it adds; from module 0.22.0, make a use at its user; from module 0.23.0, make the
          // Gamemaster's rolls as a character, marked as theirs; from module 0.25.0, list the
          // messages each of those made in its result, which only this listener reads, never a
          // viewer; from module 0.26.0, let players enter their own dice's results; and from
          // module 0.27.0, ask here what Midi-QOL asks of characters, which nothing reads yet.
          rollFeatures: [
            ...(features?.rolls?.modifiers === true ? ['modifiers'] : []),
            ...(features?.rolls?.prompts === true ? ['prompts'] : []),
            ...(features?.rolls?.areaAttacks === true ? ['areaAttacks'] : []),
            ...(features?.rolls?.activityChecks === true
              ? ['activityChecks']
              : []),
            ...(features?.rolls?.signedDice === true ? ['signedDice'] : []),
            ...(features?.rolls?.selfTargets === true ? ['selfTargets'] : []),
            ...(features?.rolls?.gmRolls === true ? ['gmRolls'] : []),
            ...(features?.rolls?.gmRollMessages === true
              ? ['gmRollMessages']
              : []),
            ...(features?.rolls?.manualDice === true ? ['manualDice'] : []),
            ...(features?.rolls?.midiPrompts === true ? ['midiPrompts'] : []),
          ],
          // Whether its players may move items and coins from here, from module 0.31.0, apart
          // from the rolls. A module before it says nothing of them, which clears it.
          transfersEnabled:
            features?.transfers?.enabled === true &&
            (features.transfers.kinds ?? []).includes('transfer'),
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
          // eslint-disable-next-line unicorn/no-null -- Prisma's filter for an unset field
          closedAt: null,
          promptId: { notIn: prompts.map(({ id }) => id) },
        },
        data: { closedAt: new Date(), closedReason: 'gone' },
      })
      for (const prompt of prompts) {
        await savePrompt(tx, campaignId, prompt, sentAt)
      }
      await tx.combat.deleteMany({ where: { campaignId } })
      await tx.combat.createMany({
        data: event.data.combats.map(combat => ({
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
      if (event.data.sheetsApart === true) {
        return keepRosterSheets(tx, campaignId, characters)
      }
      await tx.actorSheet.deleteMany({ where: { campaignId } })
      await tx.actorSheet.createMany({
        data: characters.flatMap(({ id, sheet }) =>
          sheet ? [{ campaignId, actorId: id, data: toJson(sheet) }] : [],
        ),
      })
      // Its descriptions came first; any no sheet refers to any more go.
      const sheets = characters.flatMap(({ sheet }) => (sheet ? [sheet] : []))
      await keepOnlySheetTexts(tx, campaignId, sheets)
      return lacksSheetTexts(tx, campaignId, sheets)
    }
    case 'character.updated': {
      const { sheet } = event.data.character
      await saveCharacter(tx, campaignId, event.data.character)
      return sheet ? lacksSheetTexts(tx, campaignId, [sheet]) : false
    }
    case 'character.texts': {
      await saveSheetTexts(tx, campaignId, event.data.texts)
      return false
    }
    case 'chat.message.created':
    case 'chat.message.updated': {
      // An update is an upsert: a blind roll the Gamemaster reveals arrives as one.
      await saveMessage(tx, campaignId, event.data.message, session)
      return false
    }
    case 'chat.message.deleted': {
      await tx.chatMessage.deleteMany({
        where: { campaignId, messageId: event.data.id },
      })
      return false
    }
    case 'chat.cleared': {
      await tx.chatMessage.deleteMany({ where: { campaignId } })
      return false
    }
    case 'combat.ended': {
      // The encounter ended, or the campaign's last character left it.
      await tx.combat.deleteMany({
        where: { campaignId, combatId: event.data.combat.id },
      })
      return false
    }
    case 'combat.created':
    case 'combat.started':
    case 'combat.turn':
    case 'combat.updated': {
      // combat.created also marks the campaign's first character joining a fight under way.
      await saveCombat(tx, campaignId, event.data.combat)
      return false
    }
    case 'combat.combatant.added':
    case 'combat.combatant.updated': {
      const { combatant } = event.data
      await patchCombat(tx, campaignId, event.data.combatId, combatants =>
        sortTurnOrder([
          ...combatants.filter(({ id }) => id !== combatant.id),
          combatant,
        ]),
      )
      return false
    }
    case 'combat.combatant.removed': {
      const { combatantId } = event.data
      await patchCombat(tx, campaignId, event.data.combatId, combatants =>
        combatants.filter(({ id }) => id !== combatantId),
      )
      return false
    }
    case 'roll.prompt.opened': {
      await savePrompt(tx, campaignId, event.data.prompt, sentAt)
      return false
    }
    case 'roll.prompt.closed': {
      await closePrompt(tx, campaignId, event.data.id, event.data.reason)
      return false
    }
    case 'group.updated': {
      const { sheet } = event.data.group
      await saveGroup(tx, campaignId, event.data.group)
      return sheet ? lacksSheetTexts(tx, campaignId, [], [sheet]) : false
    }
    case 'group.removed': {
      await removeGroup(tx, campaignId, event.data.id)
      return false
    }
    case 'bridge.settings': {
      if (event.data.settings) {
        await saveFoundrySettings(tx, campaignId, event.data.settings, sentAt)
      }
      return false
    }
  }
  return false
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
  // Its descriptions come after it: those the sheets kept don't refer to go, its characters' or
  // its groups'.
  const [kept, keptGroups] = await Promise.all([
    tx.actorSheet.findMany({ where: { campaignId }, select: { data: true } }),
    tx.groupSheet.findMany({ where: { campaignId }, select: { data: true } }),
  ])
  await keepOnlySheetTexts(
    tx,
    campaignId,
    kept.map(({ data }) => data as unknown as CharacterSheet),
    keptGroups.map(({ data }) => data as unknown as GroupSheet),
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
 * module never asks again on the same card. What Midi-QOL asks waits a minute at most, by the
 * game's clock, which may not be this app's: it's held here as waiting, from when it came, what was
 * left of its wait when it was sent, so that its player is shown how long they have; and it's never
 * moved by its later copies, as a hello's. A hello may be the first to carry one, after it has
 * waited a while, when the post that opened it was lost. The time an envelope is sent is when the
 * module queued it, so a post held up in its queue isn't counted.
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
    // eslint-disable-next-line unicorn/no-null -- Prisma's filter for an unset field
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
