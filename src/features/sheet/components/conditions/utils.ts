import { CONDITIONS } from '@/features/sheet/components/conditions/constants'

/** The rules of a condition the app has them for, by its id, such as "prone". */
export function rulesOf(id: string) {
  return CONDITIONS.find(condition => condition.id === id)
}

/**
 * The rules of the condition a text names, where the app has them: by its name, in any letter
 * case, such as "Charmed" as dnd5e labels one; none for text that names none ("Poison"), or names
 * one in another language.
 */
export function conditionNamed(text: string) {
  const name = text.trim().toLowerCase()
  return CONDITIONS.find(condition => condition.name.toLowerCase() === name)
}
