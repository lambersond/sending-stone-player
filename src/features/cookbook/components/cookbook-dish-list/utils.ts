import { DISH_ATTEMPTS } from '@/constants/cookbook'
import { formatModifier } from '@/utils/format-modifier'
import type { CookbookDishView } from '@/types/cookbook'

/** What became of a dish, in its player's words. */
export function dishState(dish: CookbookDishView, live: boolean): string {
  switch (dish.state) {
    case 'queued':
    case 'claimed': {
      return live
        ? 'Waiting for Foundry'
        : 'Waiting for Foundry · your Gamemaster’s game isn’t open'
    }
    case 'delivered': {
      return 'With your Gamemaster'
    }
    case 'applied': {
      // Served before the Gamemaster's choice of who ate it is heard of, the names come later.
      const who =
        dish.eatenBy.length > 0
          ? `Eaten by ${namesOf(dish.eatenBy)}`
          : 'Served in Foundry'
      return [who, ...dish.rolled.map(rolled => rolledWords(rolled))].join(
        ' · ',
      )
    }
    case 'dismissed': {
      return dish.reason === 'deleted'
        ? 'Removed in Foundry'
        : 'Set aside by your Gamemaster'
    }
    case 'failed': {
      if (dish.reason === 'undeliverable') {
        return `Couldn’t reach the game: Foundry didn’t answer after ${DISH_ATTEMPTS} tries.`
      }
      if (dish.reason === 'invalid') {
        return 'Couldn’t reach the game: your Gamemaster’s Foundry couldn’t read this dish.'
      }
      return `Couldn’t reach the game: Foundry refused it (${dish.reason}).`
    }
  }
}

/** Names as a sentence lists them: "Thorin", "Thorin and Vex", "Thorin, Vex and Rook". */
function namesOf(names: string[]): string {
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** A value its dice rolled once in the cookbook: "Max HP +7 (3+1d6)". */
function rolledWords({
  type,
  value,
  formula,
}: CookbookDishView['rolled'][number]): string {
  const kind = type === 'maxHitPoints' ? 'Max HP' : type
  return `${kind} ${formatModifier(value)}${formula ? ` (${formula})` : ''}`
}
