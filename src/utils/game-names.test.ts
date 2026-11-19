import {
  DND5E_NAMES,
  abilityAbbreviation,
  abilityName,
  gameNames,
  isAbilityKey,
  skillName,
} from './game-names'

describe('utils/game-names', () => {
  describe('isAbilityKey', () => {
    it.each(['str', 'hon', 'san', 'luck', 'my-luck', 'a'.repeat(32)])(
      'takes %s',
      id => {
        expect(isAbilityKey(id)).toBe(true)
      },
    )

    it.each([
      'constructor',
      'valueOf',
      '__proto__',
      '1x',
      'a b',
      'my.luck',
      '',
      'a'.repeat(33),
      7,
      undefined,
    ])('refuses %s', id => {
      expect(isAbilityKey(id)).toBe(false)
    })
  })

  describe('gameNames', () => {
    // A French game with Honor on and a world's own skill on it, named by a translation module.
    const sheet = {
      abilities: [
        { id: 'wis', label: 'Sagesse', abbreviation: 'SAG' },
        { id: 'hon', label: 'Honor', abbreviation: 'hon' },
        { id: 'san', label: 'Santé mentale', abbreviation: '' },
        { id: 'luck', label: ' ', abbreviation: 'lck' },
      ],
      skills: [
        { id: 'eti', label: 'Etiquette' },
        { id: 'ath', label: '' },
      ],
    }
    const names = gameNames(sheet)

    it("names abilities and skills as the sheet does, the game's language and the world's own", () => {
      expect(abilityName(names, 'wis')).toBe('Sagesse')
      expect(abilityName(names, 'hon')).toBe('Honor')
      expect(abilityName(names, 'san')).toBe('Santé mentale')
      expect(skillName(names, 'eti')).toBe('Etiquette')
      expect(abilityAbbreviation(names, 'wis')).toBe('SAG')
      expect(abilityAbbreviation(names, 'luck')).toBe('lck')
    })

    it("leaves a blank name to dnd5e's English, then to the key", () => {
      expect(abilityName(names, 'str')).toBe('Strength')
      expect(skillName(names, 'ath')).toBe('Athletics')
      expect(abilityName(names, 'luck')).toBe('luck')
      expect(abilityAbbreviation(names, 'san')).toBe('san')
      expect(abilityAbbreviation(names, 'str')).toBe('str')
    })

    it("names dnd5e's six and 18 in English where no sheet is at hand, else by the key", () => {
      expect(DND5E_NAMES).toEqual(gameNames())
      expect(abilityName(DND5E_NAMES, 'dex')).toBe('Dexterity')
      expect(skillName(DND5E_NAMES, 'slt')).toBe('Sleight of Hand')
      expect(abilityName(DND5E_NAMES, 'san')).toBe('san')
      expect(abilityName(DND5E_NAMES, 'constructor')).toBe('constructor')
      expect(abilityAbbreviation(DND5E_NAMES, 'dex')).toBe('dex')
    })
  })
})
