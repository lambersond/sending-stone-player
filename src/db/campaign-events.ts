import prisma from '@/clients/prisma'
import { ROLL_KINDS } from '@/constants/sending-stone'
import {
  keepOnlySheetTexts,
  lacksSheetTexts,
  saveSheetTexts,
} from '@/db/sheet-texts'
import type {
  CampaignRef,
  CombatantSummary,
  CombatSnapshot,
  ConnectedCharacter,
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
 * @returns Whether the campaign now lacks a description its sheets refer to, which the module
 * should send again with a hello.
 */
export async function applyCampaignEvent(
  campaignId: string,
  world: World,
  campaign: CampaignRef,
  event: GameEvent,
  session: string,
): Promise<{ lacksTexts: boolean }> {
  return prisma.$transaction(async tx => {
    const lacksTexts = await apply(tx, campaignId, event)
    const now = new Date()
    await tx.campaign.update({
      where: { id: campaignId },
      data: {
        // The Gamemaster can rename the campaign, and a game can switch worlds.
        title: campaign.title,
        worldId: world.id,
        worldTitle: world.title,
        // Descriptions change nothing anyone sees until a sheet refers to them.
        ...(event.type !== 'character.texts' && { version: { increment: 1 } }),
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
): Promise<boolean> {
  switch (event.type) {
    case 'bridge.hello': {
      // The campaign's full current state. It carries no chat, so the chat log is kept.
      const { characters, features } = event.data
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          characters: characters.map(character => rosterEntry(character)),
          // Whether its players may roll in the game from here. A module before 0.10.0 can't
          // make their rolls, and says nothing of them.
          rollsEnabled: features?.rolls?.enabled === true,
          rollKinds: (features?.rolls?.kinds ?? []).filter(kind =>
            (ROLL_KINDS as readonly string[]).includes(kind),
          ),
          // What else it can do with them: from module 0.13.0, take damage a player changed.
          rollFeatures:
            features?.rolls?.modifiers === true ? ['modifiers'] : [],
        },
      })
      await tx.actorSheet.deleteMany({ where: { campaignId } })
      await tx.actorSheet.createMany({
        data: characters.flatMap(({ id, sheet }) =>
          sheet ? [{ campaignId, actorId: id, data: toJson(sheet) }] : [],
        ),
      })
      await tx.combat.deleteMany({ where: { campaignId } })
      await tx.combat.createMany({
        data: event.data.combats.map(combat => ({
          campaignId,
          combatId: combat.id,
          data: toJson(combat),
        })),
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
      await saveMessage(tx, campaignId, event.data.message)
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
  }
  return false
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
  const entry = rosterEntry(character)
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

/** A character as the roster keeps it: everything but its sheet, which is kept on its own. */
function rosterEntry(character: ConnectedCharacter) {
  const entry = { ...character }
  delete entry.sheet
  return toJson(entry)
}

async function saveMessage(
  tx: Tx,
  campaignId: string,
  message: SerializedMessage,
) {
  const fields = {
    sentAt: new Date(message.timestamp),
    public: message.audience.public,
    readers: message.audience.characters,
    data: toJson(message),
  }
  await tx.chatMessage.upsert({
    where: { campaignMessage: { campaignId, messageId: message.id } },
    create: { campaignId, messageId: message.id, ...fields },
    update: fields,
  })
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
