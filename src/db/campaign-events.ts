import prisma from '@/clients/prisma'
import type {
  CampaignRef,
  CombatantSummary,
  CombatSnapshot,
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
 * @param origin - The game's origin, from the request's Origin header.
 * @param world - The Foundry world the event came from.
 * @param campaign - The campaign the module sent the event to.
 * @param event - The event, its payload already checked.
 */
export async function applyCampaignEvent(
  origin: string,
  world: World,
  campaign: CampaignRef,
  event: GameEvent,
): Promise<void> {
  await prisma.$transaction(async tx => {
    const campaignId = await enterCampaign(tx, origin, world, campaign)
    await apply(tx, campaignId, event)
    await tx.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 }, lastEventAt: new Date() },
    })
  })
}

/**
 * Find or create the campaign. Its title and world are refreshed from every event, since the
 * Gamemaster can rename the campaign; the module's id for it never changes.
 * @returns The campaign's id.
 */
async function enterCampaign(
  tx: Tx,
  origin: string,
  world: World,
  campaign: CampaignRef,
) {
  const details = {
    title: campaign.title,
    worldId: world.id,
    worldTitle: world.title,
  }
  const { id } = await tx.campaign.upsert({
    where: { originCampaign: { origin, foundryId: campaign.id } },
    create: { origin, foundryId: campaign.id, ...details },
    update: details,
    select: { id: true },
  })
  return id
}

async function apply(tx: Tx, campaignId: string, event: GameEvent) {
  switch (event.type) {
    case 'bridge.hello': {
      // The campaign's full current state. It carries no chat, so the chat log is kept.
      await tx.campaign.update({
        where: { id: campaignId },
        data: { characters: event.data.characters },
      })
      await tx.combat.deleteMany({ where: { campaignId } })
      await tx.combat.createMany({
        data: event.data.combats.map(combat => ({
          campaignId,
          combatId: combat.id,
          data: toJson(combat),
        })),
      })
      return
    }
    case 'chat.message.created':
    case 'chat.message.updated': {
      // An update is an upsert: a blind roll the Gamemaster reveals arrives as one.
      await saveMessage(tx, campaignId, event.data.message)
      return
    }
    case 'chat.message.deleted': {
      await tx.chatMessage.deleteMany({
        where: { campaignId, messageId: event.data.id },
      })
      return
    }
    case 'chat.cleared': {
      await tx.chatMessage.deleteMany({ where: { campaignId } })
      return
    }
    case 'combat.ended': {
      // The encounter ended, or the campaign's last character left it.
      await tx.combat.deleteMany({
        where: { campaignId, combatId: event.data.combat.id },
      })
      return
    }
    case 'combat.created':
    case 'combat.started':
    case 'combat.turn':
    case 'combat.updated': {
      // combat.created also marks the campaign's first character joining a fight under way.
      await saveCombat(tx, campaignId, event.data.combat)
      return
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
      return
    }
    case 'combat.combatant.removed': {
      const { combatantId } = event.data
      await patchCombat(tx, campaignId, event.data.combatId, combatants =>
        combatants.filter(({ id }) => id !== combatantId),
      )
      return
    }
  }
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
