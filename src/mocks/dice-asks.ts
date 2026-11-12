import type { HeldDiceAsk } from '@/types/dice-asks'
import type { GameDiceAsk } from '@/types/sending-stone'
import type { TableDiceAsk } from '@/types/table'

/*
 * Dice the game asks a typing player for (module 0.44.0), as the module, the app's table and its
 * view hold them: dnd5e's Ice Knife's Shard Explosion, 2d6 cold, which Midi-QOL rolls after the
 * 1d10 of Thorin's typed damage, `roll-thorin-1`.
 */

/** When the module asked it, by the game's clock, and when its minute is up. */
export const ASKED_AT = '2026-11-10T12:00:00.000Z'
export const ASK_EXPIRES = '2026-11-10T12:01:00.000Z'

/** Ice Knife's ask as the module sends it. */
export function iceKnifeAsk(fields: Partial<GameDiceAsk> = {}): GameDiceAsk {
  return {
    id: 'ask1',
    actorId: 'actor-thorin',
    command: 'roll-thorin-1',
    label: 'Ice Knife: Shard Explosion',
    purpose: 'damage',
    critical: false,
    rolls: [
      {
        formula: '2d6',
        type: 'cold',
        flavor: 'Cold',
        terms: [{ faces: 6, number: 2 }],
      },
    ],
    askedAt: ASKED_AT,
    expiresAt: ASK_EXPIRES,
    ...fields,
  }
}

/** Its row, as held: asked at noon by this app's clock, open. */
export function heldIceKnife(fields: Partial<HeldDiceAsk> = {}): HeldDiceAsk {
  const { label, purpose, critical, rolls } = iceKnifeAsk()
  return {
    askId: 'ask1',
    actorId: 'actor-thorin',
    ofActorId: null,
    commandId: 'roll-thorin-1',
    data: { label, purpose, critical, rolls },
    askedAt: new Date(ASKED_AT),
    expiresAt: new Date(ASK_EXPIRES),
    closedAt: null,
    closedReason: null,
    ...fields,
  }
}

/** As Thorin's page is shown it. */
export function tableIceKnife(
  fields: Partial<TableDiceAsk> = {},
): TableDiceAsk {
  const { label, purpose, rolls } = iceKnifeAsk()
  return {
    id: 'ask1',
    command: 'roll-thorin-1',
    label,
    purpose,
    rolls,
    expiresAt: ASK_EXPIRES,
    ...fields,
  }
}

/**
 * An ask of two rolls, as Ice Knife cast at 2nd level with a fire rider would be: 3d6 cold, then
 * 1d4 + 1d6 fire, each of its terms answered, or left out, on its own.
 */
export function twoRollsAsk(fields: Partial<TableDiceAsk> = {}): TableDiceAsk {
  return tableIceKnife({
    rolls: [
      { formula: '3d6', type: 'cold', terms: [{ faces: 6, number: 3 }] },
      {
        formula: '1d4 + 1d6',
        type: 'fire',
        terms: [
          { faces: 4, number: 1 },
          { faces: 6, number: 1 },
        ],
      },
    ],
    ...fields,
  })
}

/**
 * Wild Sparks' die more, as Thorin's page is shown it: his typed 6 on its 1d6x exploded, and the
 * game asks for the die it throws again, named by the roll as module 0.45.0 names it.
 */
export function sparksAgain(fields: Partial<TableDiceAsk> = {}): TableDiceAsk {
  return tableIceKnife({
    label: 'Wild Sparks: Burst',
    purpose: 'again',
    again: 'explode',
    rolls: [{ formula: '1d6x', terms: [{ faces: 6, number: 1 }] }],
    ...fields,
  })
}
