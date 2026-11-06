/**
 * @jest-environment node
 */
import { paneOffers } from './utils'
import type { CreatureFacts } from '@/types/table'

/** Thorin's Wolf, at its own pane. */
const WOLF: CreatureFacts = {
  name: 'Wolf',
  relation: { kind: 'owned', of: 'Thorin' },
}

describe('features/sheet/components/character-pane/utils, paneOffers', () => {
  it.each([
    ['the player, at the character’s pane', 'player', undefined, false, true],
    ['the player, while shaped, the form’s', 'player', undefined, true, true],
    ['the player, at a companion’s pane, its own', 'player', WOLF, false, true],
    ['the Gamemaster, at the character’s page', 'gm', undefined, false, false],
    ['the Gamemaster, at a companion’s pane', 'gm', WOLF, false, false],
  ] as const)(
    'offers hit points set from here (module 0.44.0) to %s: %s',
    (_name, role, creature, shaped, offered) => {
      const offers = paneOffers({
        prepares: false,
        hitPoints: true,
        creature,
        role,
        shaped,
      })
      expect(offers.hitPoints).toBe(offered)
    },
  )

  it('offers none where the campaign doesn’t let the player', () => {
    expect(
      paneOffers({ prepares: false, role: 'player', shaped: false }).hitPoints,
    ).toBe(false)
  })
})
