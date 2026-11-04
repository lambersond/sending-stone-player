import { availableRollFeatures, availableRollKinds } from './availability'

const NOW = Date.parse('2026-10-09T20:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

describe('utils/roll-requests', () => {
  describe('availableRollKinds', () => {
    const campaign = {
      rollsEnabled: true,
      rollKinds: ['save', 'skill', 'attack', 'heal'],
      bridgePolledAt: ago(10_000),
    }

    it('offers the rolls the game takes, while the module is fetching them', () => {
      expect(availableRollKinds(campaign, NOW)).toEqual([
        'skill',
        'save',
        'attack',
      ])
    })

    it('offers none while the Gamemaster has them off, or the module has stopped fetching', () => {
      expect(
        availableRollKinds({ ...campaign, rollsEnabled: false }, NOW),
      ).toEqual([])
      expect(
        availableRollKinds({ ...campaign, bridgePolledAt: ago(45_000) }, NOW),
      ).toEqual([])
      expect(
        availableRollKinds({ ...campaign, bridgePolledAt: null }, NOW),
      ).toEqual([])
    })
  })

  describe('availableRollFeatures', () => {
    const campaign = {
      rollsEnabled: true,
      rollKinds: ['save', 'damage'],
      bridgePolledAt: ago(10_000),
      // As stored, in the module's order, with what only the listener reads.
      rollFeatures: [
        'gmRollMessages',
        'manualDice',
        'midiPrompts',
        'companionPrompts',
        'effectDice',
        'keptRerolls',
      ],
    }

    it("offers what else the game does with the rolls, a typed roll's effects' dice and rerolls kept last, from module 0.42.0", () => {
      expect(availableRollFeatures(campaign, NOW)).toEqual([
        'manualDice',
        'companionPrompts',
        'effectDice',
        'keptRerolls',
      ])
      expect(
        availableRollFeatures(
          { ...campaign, rollFeatures: ['keptRerolls', 'manualDice'] },
          NOW,
        ),
      ).toEqual(['manualDice', 'keptRerolls'])
    })

    it('offers none while the game takes no rolls', () => {
      expect(
        availableRollFeatures({ ...campaign, rollsEnabled: false }, NOW),
      ).toEqual([])
      expect(
        availableRollFeatures({ ...campaign, bridgePolledAt: null }, NOW),
      ).toEqual([])
    })
  })
})

describe('utils/roll-requests, a spell slot spent or restored, from module 0.42.1', () => {
  it('keeps it among the rolls a game takes, where it lists it, and not where it doesn’t', () => {
    const campaign = {
      rollsEnabled: true,
      rollKinds: ['skill', 'spend', 'inspiration', 'spellSlot'],
      bridgePolledAt: ago(5000),
    }
    expect(availableRollKinds(campaign, NOW)).toEqual([
      'skill',
      'spend',
      'inspiration',
      'spellSlot',
    ])
    expect(
      availableRollKinds(
        { ...campaign, rollKinds: ['skill', 'spend', 'inspiration'] },
        NOW,
      ),
    ).not.toContain('spellSlot')
  })
})

describe('utils/roll-requests, a spell prepared or unprepared, from module 0.42.1', () => {
  it('keeps it among the rolls a game takes, where it lists it, and not where it doesn’t', () => {
    // No spell slots among them: preparing holds with the spell slots taken out.
    const campaign = {
      rollsEnabled: true,
      rollKinds: ['skill', 'spend', 'inspiration', 'prepare'],
      bridgePolledAt: ago(5000),
    }
    expect(availableRollKinds(campaign, NOW)).toEqual([
      'skill',
      'spend',
      'inspiration',
      'prepare',
    ])
    expect(
      availableRollKinds(
        { ...campaign, rollKinds: ['skill', 'spend', 'inspiration'] },
        NOW,
      ),
    ).not.toContain('prepare')
  })
})
