import { toChoice } from './campaign-choice'

const ORIGIN = 'https://my-game.forge-vtt.com'

/** A campaign of three characters: Thorin chosen by user-1, Vex by user-2, Bard by no one. */
const campaign = {
  id: 'c1',
  title: 'The Lonely Mountain',
  worldTitle: null,
  origin: ORIGIN,
  characters: [
    { id: 'actor-thorin', name: 'Thorin Oakenshield' },
    { id: 'actor-vex', name: 'Vex' },
    { id: 'actor-bard', name: 'Bard' },
  ],
  owner: { name: 'Gandalf' },
  players: [
    { id: 'char-1', actorId: 'actor-thorin', userId: 'user-1' },
    { id: 'char-2', actorId: 'actor-vex', userId: 'user-2' },
    // A character of user-1's that chose none yet claims none.
    { id: 'char-3', actorId: null, userId: 'user-1' },
  ],
}

describe('utils/campaign-choice', () => {
  describe('toChoice', () => {
    it("offers a campaign's characters, showing which are the player's and which someone else's", () => {
      expect(toChoice(campaign, 'user-1')).toEqual({
        id: 'c1',
        title: 'The Lonely Mountain',
        worldTitle: undefined,
        gameUrl: ORIGIN,
        gamemaster: 'Gandalf',
        characters: [
          {
            id: 'actor-thorin',
            name: 'Thorin Oakenshield',
            claimedBy: 'you',
            characterId: 'char-1',
          },
          { id: 'actor-vex', name: 'Vex', claimedBy: 'someone' },
          { id: 'actor-bard', name: 'Bard' },
        ],
      })
    })

    it("doesn't count a character's own choice against it when it chooses again", () => {
      const choice = toChoice(
        { ...campaign, worldTitle: 'Erebor', owner: null },
        'user-1',
        'char-1',
      )
      expect(choice.worldTitle).toBe('Erebor')
      expect(choice.gamemaster).toBeUndefined()
      expect(choice.characters[0]).toEqual({
        id: 'actor-thorin',
        name: 'Thorin Oakenshield',
      })
      expect(choice.characters[1]).toHaveProperty('claimedBy', 'someone')
    })
  })
})
