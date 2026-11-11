import { ABILITIES, SKILLS } from '@/constants/dnd5e'
import type { DiceAskData } from '@/types/dice-asks'
import type { PromptData } from '@/types/prompts'
import type { CompanionAsked } from '@/types/table'

// What the game asks of a character's companions (module 0.41.0), as its character's view marks
// each one asked (src/db/table.ts).

/**
 * The companions the game is asking a save of now, from module 0.41.0, and from module 0.44.0 the
 * dice of in their character's typed rolls' runs, each once, its saves first, in the order first
 * asked: what its first prompt still waiting asks for, in words, else its first dice ask's label,
 * marked as dice; and when the soonest of all those stops waiting. A prompt whose time has run out
 * waits no more, though Midi-QOL may still be rolling it its own way: a companion with none other
 * isn't asked.
 * @param held - Its companions' prompts still open, oldest first.
 * @param diceAsks - Its companions' dice asks still open, oldest first.
 */
export function companionAsks(
  held: { actorId: string; data: unknown; expiresAt: Date }[],
  now = Date.now(),
  diceAsks: { actorId: string; data: unknown; expiresAt: Date }[] = [],
): CompanionAsked[] {
  const asked = new Map<string, CompanionAsked>()
  const all = [
    ...held.map(({ actorId, data, expiresAt }) => ({
      actorId,
      expiresAt,
      label: askedFor(data as PromptData),
    })),
    ...diceAsks.map(({ actorId, data, expiresAt }) => ({
      actorId,
      expiresAt,
      label: (data as DiceAskData).label,
      dice: true as const,
    })),
  ]
  for (const { actorId, expiresAt: until, ...said } of all) {
    if (until.getTime() <= now) continue
    const expiresAt = until.toISOString()
    const known = asked.get(actorId)
    if (!known) {
      asked.set(actorId, { key: actorId, ...said, expiresAt })
    } else if (expiresAt < known.expiresAt) {
      known.expiresAt = expiresAt
    }
  }
  return [...asked.values()]
}

/** Abilities or skills by their names, such as "Strength or Dexterity". */
function either(keys: string[] = [], names: Record<string, string>): string {
  return new Intl.ListFormat('en', { type: 'disjunction' }).format(
    keys.map(key => names[key] ?? key),
  )
}

/**
 * What a save the game asks for asks, in words: such as "Dexterity saving throw", "Strength or
 * Dexterity saving throw", "Concentration check", naming its ability where it isn't Constitution,
 * or for Midi-QOL's checks "Athletics or Acrobatics check".
 */
function askedFor(data: PromptData): string {
  const [ability] = data.abilities ?? []
  switch (data.type) {
    case 'concentration': {
      return ability && ability !== 'con'
        ? `Concentration check (${ABILITIES[ability] ?? ability})`
        : 'Concentration check'
    }
    case 'check': {
      return `${either(data.abilities, ABILITIES)} check`.trim()
    }
    case 'skill': {
      return `${either(data.skills, SKILLS)} check`.trim()
    }
    default: {
      return `${either(data.abilities, ABILITIES)} saving throw`.trim()
    }
  }
}
