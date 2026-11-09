import { ABILITIES, SKILLS } from '@/constants/dnd5e'
import type { PromptData } from '@/types/prompts'
import type { CompanionAsked } from '@/types/table'

// What the game asks of a character's companions (module 0.41.0), as its character's view marks
// each one asked (src/db/table.ts).

/**
 * The companions the game is asking a save of now, from module 0.41.0, each once, in the order
 * first asked: what its first prompt still waiting asks for, in words, and when the soonest of
 * those stops waiting. A prompt whose time has run out waits no more, though Midi-QOL may still be
 * rolling it its own way: a companion with none other isn't asked.
 * @param held - Its companions' prompts still open, oldest first.
 */
export function companionAsks(
  held: { actorId: string; data: unknown; expiresAt: Date }[],
  now = Date.now(),
): CompanionAsked[] {
  const asked = new Map<string, CompanionAsked>()
  for (const prompt of held) {
    if (prompt.expiresAt.getTime() <= now) continue
    const expiresAt = prompt.expiresAt.toISOString()
    const known = asked.get(prompt.actorId)
    if (!known) {
      asked.set(prompt.actorId, {
        key: prompt.actorId,
        label: askedFor(prompt.data as PromptData),
        expiresAt,
      })
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
