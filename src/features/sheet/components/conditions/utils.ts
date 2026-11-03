import { CONDITIONS } from '@/features/sheet/components/conditions/constants'

/** The rules of a condition the app has them for, by its id, such as "prone". */
export function rulesOf(id: string) {
  return CONDITIONS.find(condition => condition.id === id)
}
