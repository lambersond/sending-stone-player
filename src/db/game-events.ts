import prisma from '@/clients/prisma'
import type {
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
 * Apply an event from a game's Gamemaster to what is held for that game.
 * @param origin - The game's origin, from the request's Origin header.
 * @param world - The Foundry world the event came from.
 * @param event - The event, its payload already checked.
 */
export async function applyGameEvent(
  origin: string,
  world: World,
  event: GameEvent,
): Promise<void> {
  await prisma.$transaction(async tx => {
    const gameId = await enterWorld(tx, origin, world)
    await apply(tx, gameId, event)
    await tx.game.update({
      where: { id: gameId },
      data: {
        version: { increment: 1 },
        lastEventAt: new Date(),
        worldTitle: world.title,
      },
    })
  })
}

/**
 * Find or create the game, starting afresh if a different world is now running at its address:
 * what was held belongs to the old world.
 * @returns The game's id.
 */
async function enterWorld(tx: Tx, origin: string, world: World) {
  const game = await tx.game.upsert({
    where: { origin },
    create: { origin, worldId: world.id, worldTitle: world.title },
    update: {},
    select: { id: true, worldId: true },
  })
  if (game.worldId !== world.id) {
    await tx.chatMessage.deleteMany({ where: { gameId: game.id } })
    await tx.combat.deleteMany({ where: { gameId: game.id } })
    await tx.game.update({
      where: { id: game.id },
      data: { worldId: world.id, characters: [] },
    })
  }
  return game.id
}

async function apply(tx: Tx, gameId: string, event: GameEvent) {
  switch (event.type) {
    case 'bridge.hello': {
      // The full current state. It carries no chat, so the chat log is kept.
      await tx.game.update({
        where: { id: gameId },
        data: { characters: event.data.characters },
      })
      await tx.combat.deleteMany({ where: { gameId } })
      await tx.combat.createMany({
        data: event.data.combats.map(combat => ({
          gameId,
          combatId: combat.id,
          data: toJson(combat),
        })),
      })
      return
    }
    case 'characters.updated': {
      await tx.game.update({
        where: { id: gameId },
        data: { characters: event.data.characters },
      })
      return
    }
    case 'chat.message.created':
    case 'chat.message.updated': {
      // An update is an upsert: a blind roll the Gamemaster reveals arrives as one.
      await saveMessage(tx, gameId, event.data.message)
      return
    }
    case 'chat.message.deleted': {
      await tx.chatMessage.deleteMany({
        where: { gameId, messageId: event.data.id },
      })
      return
    }
    case 'chat.cleared': {
      await tx.chatMessage.deleteMany({ where: { gameId } })
      return
    }
    case 'combat.ended': {
      await tx.combat.deleteMany({
        where: { gameId, combatId: event.data.combat.id },
      })
      return
    }
    case 'combat.created':
    case 'combat.started':
    case 'combat.turn':
    case 'combat.updated': {
      await saveCombat(tx, gameId, event.data.combat)
      return
    }
    case 'combat.combatant.added':
    case 'combat.combatant.updated': {
      const { combatant } = event.data
      await patchCombat(tx, gameId, event.data.combatId, combatants =>
        sortTurnOrder([
          ...combatants.filter(({ id }) => id !== combatant.id),
          combatant,
        ]),
      )
      return
    }
    case 'combat.combatant.removed': {
      const { combatantId } = event.data
      await patchCombat(tx, gameId, event.data.combatId, combatants =>
        combatants.filter(({ id }) => id !== combatantId),
      )
      return
    }
  }
}

async function saveMessage(tx: Tx, gameId: string, message: SerializedMessage) {
  const fields = {
    sentAt: new Date(message.timestamp),
    public: message.audience.public,
    readers: message.audience.characters,
    data: toJson(message),
  }
  await tx.chatMessage.upsert({
    where: { gameMessage: { gameId, messageId: message.id } },
    create: { gameId, messageId: message.id, ...fields },
    update: fields,
  })
}

async function saveCombat(tx: Tx, gameId: string, combat: CombatSnapshot) {
  await tx.combat.upsert({
    where: { gameCombat: { gameId, combatId: combat.id } },
    create: { gameId, combatId: combat.id, data: toJson(combat) },
    update: { data: toJson(combat) },
  })
}

/**
 * Change a held combat's combatants. A combat not held is left alone: the next snapshot of it,
 * which every turn change carries, brings it in.
 */
async function patchCombat(
  tx: Tx,
  gameId: string,
  combatId: string,
  change: (combatants: CombatantSummary[]) => CombatantSummary[],
) {
  const held = await tx.combat.findUnique({
    where: { gameCombat: { gameId, combatId } },
    select: { data: true },
  })
  if (!held) return
  const combat = held.data as unknown as CombatSnapshot
  await saveCombat(tx, gameId, {
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
