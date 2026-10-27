/* eslint-disable unicorn/no-null -- Prisma uses null for an unset date */
import {
  articled,
  canReturn,
  checkWildShape,
  hoursWords,
  isIncapacitated,
  isShaped,
  timeLeftWords,
  usableForm,
  wildShapeAvailable,
} from './wild-shape'
import {
  druidSheet,
  FORM_IDS,
  KNOWN_FORMS,
  knownForm,
  shapedSheet,
  wildShapeBlock,
  wolfForm,
} from '@/mocks/sending-stone'
import { parseGameEvent } from '@/schemas/sending-stone'
import type { WildShapeInput } from '@/types/roll'
import type {
  CharacterSheet,
  KnownForm,
  SheetCondition,
  SheetWildShape,
} from '@/types/sending-stone'

const NOW = Date.parse('2026-10-29T12:00:00Z')

/** A status on the sheet, as the module lists the character's statuses. */
const condition = (id: string): SheetCondition => ({
  id,
  name: id,
  img: null,
  level: null,
  detail: null,
  text: null,
})

/** Elowen changing into her known Wolf, as the picker sends it. */
const INTO_WOLF: WildShapeInput = { op: 'transform', form: FORM_IDS.wolf }
const INTO_BEAR: WildShapeInput = { op: 'transform', form: FORM_IDS.blackBear }
const RETURN: WildShapeInput = { op: 'revert' }
const FORMS: WildShapeInput = { op: 'forms' }
/** A Riding Horse learned, into an empty place or in place of a known form. */
const learn = (replace: string | null): WildShapeInput => ({
  op: 'learn',
  uuid: 'Compendium.dnd5e.actors24.Actor.mmRidingHorse000',
  replace,
})

/** Elowen, herself, with these changes to her sheet. */
const elowen = (fields: Partial<CharacterSheet> = {}) => druidSheet(fields)

describe('utils/wild-shape, from module 0.40.0', () => {
  describe('wildShapeAvailable', () => {
    it('is so while the campaign lets its players and its module is fetching', () => {
      const polled = new Date(NOW - 5000)
      expect(
        wildShapeAvailable(
          { wildShapeEnabled: true, bridgePolledAt: polled },
          NOW,
        ),
      ).toBe(true)
      expect(
        wildShapeAvailable(
          { wildShapeEnabled: false, bridgePolledAt: polled },
          NOW,
        ),
      ).toBe(false)
      expect(
        wildShapeAvailable(
          { wildShapeEnabled: true, bridgePolledAt: null },
          NOW,
        ),
      ).toBe(false)
    })

    it('is so for a fetch 44 seconds ago, and no longer at 46', () => {
      expect(
        wildShapeAvailable(
          { wildShapeEnabled: true, bridgePolledAt: new Date(NOW - 44_000) },
          NOW,
        ),
      ).toBe(true)
      expect(
        wildShapeAvailable(
          { wildShapeEnabled: true, bridgePolledAt: new Date(NOW - 46_000) },
          NOW,
        ),
      ).toBe(false)
    })
  })

  describe('isShaped', () => {
    it('is so for a sheet with a form, of any kind, and not for one without', () => {
      expect(isShaped(shapedSheet())).toBe(true)
      expect(isShaped(shapedSheet({ form: wolfForm({ kind: 'other' }) }))).toBe(
        true,
      )
      expect(isShaped(elowen())).toBe(false)
      expect(isShaped()).toBe(false)
      expect(isShaped(null)).toBe(false)
    })
  })

  describe('isIncapacitated', () => {
    it.each([
      ['at 0 hit points', { hp: { value: 0, max: 38, temp: 0 } }],
      ['below 0 hit points', { hp: { value: -3, max: 38, temp: 5 } }],
      ['Paralyzed', { conditions: [condition('paralyzed')] }],
      ['Unconscious', { conditions: [condition('unconscious')] }],
      ['Incapacitated', { conditions: [condition('incapacitated')] }],
      ['Petrified', { conditions: [condition('petrified')] }],
      ['Stunned', { conditions: [condition('stunned')] }],
      ['asleep', { conditions: [condition('sleeping')] }],
      ['dead', { conditions: [condition('dead')] }],
    ])('is so %s', (_name, fields) => {
      expect(isIncapacitated(elowen(fields as Partial<CharacterSheet>))).toBe(
        true,
      )
    })

    it('is not so standing, Prone, Poisoned or concentrating, nor with no hit points sent', () => {
      expect(isIncapacitated(elowen())).toBe(false)
      expect(
        isIncapacitated(
          elowen({
            conditions: ['prone', 'poisoned', 'concentrating'].map(id =>
              condition(id),
            ),
          }),
        ),
      ).toBe(false)
      expect(isIncapacitated(elowen({ hp: null }))).toBe(false)
      expect(isIncapacitated()).toBe(false)
    })
  })

  describe('usableForm', () => {
    it('is so for a form from the campaign’s compendiums that fits the rules and is found', () => {
      expect(usableForm(KNOWN_FORMS.wolf)).toBe(true)
      expect(usableForm({ ...KNOWN_FORMS.wolf, found: true })).toBe(true)
    })

    it.each([
      [
        'from anywhere else, by its name alone',
        { id: 'Zq0Lm4Tn8Rb2Vc6X', name: 'Giant Elk', pool: false },
      ],
      ['outside the rules for her now', { ...KNOWN_FORMS.wolf, fits: false }],
      [
        'not loaded yet, whether it fits unsaid',
        {
          id: FORM_IDS.wolf,
          uuid: KNOWN_FORMS.wolf.uuid,
          name: 'Wolf',
          pool: true,
        },
      ],
      ['no longer found in Foundry', { ...KNOWN_FORMS.wolf, found: false }],
    ])('is not so for one %s', (_name, known) => {
      expect(usableForm(known)).toBe(false)
    })
  })

  describe('canReturn', () => {
    it('is so for a 2024 Wild Shape the module times, on a sheet with her Wild Shape', () => {
      expect(canReturn(shapedSheet())).toBe(true)
    })

    it.each([
      [
        'a 2014 Wild Shape, which the module never times',
        shapedSheet({ form: wolfForm({ hours: null, minutesLeft: null }) }),
      ],
      [
        'a Polymorph',
        shapedSheet({
          form: wolfForm({
            kind: 'other',
            name: 'Giant Ape',
            profile: null,
            hours: null,
            minutesLeft: null,
          }),
        }),
      ],
      [
        'a form on a sheet without Wild Shape, as no 2024 druid’s',
        shapedSheet({ wildShape: undefined }),
      ],
      ['her own sheet', elowen()],
    ])('is not so for %s', (_name, sheet) => {
      expect(canReturn(sheet)).toBe(false)
    })
  })

  describe('checkWildShape', () => {
    it('takes a change into a known form usable from here, while herself or shaped', () => {
      expect(checkWildShape(INTO_WOLF, elowen())).toBeUndefined()
      expect(checkWildShape(INTO_BEAR, shapedSheet())).toBeUndefined()
    })

    it('refuses every op on a sheet without her Wild Shape as gone, as on no sheet at all', () => {
      for (const input of [INTO_WOLF, RETURN, FORMS, learn(null)]) {
        expect(checkWildShape(input, elowen({ wildShape: undefined }))).toBe(
          'gone',
        )
        expect(checkWildShape(input)).toBe('gone')
        expect(checkWildShape(input, null)).toBe('gone')
      }
    })

    it.each([
      [
        'not one of her known forms',
        { op: 'transform', form: 'Ab0cD1eF2gH3iJ4k' },
      ],
      [
        'one from anywhere but the campaign’s compendiums',
        { op: 'transform', form: 'Zq0Lm4Tn8Rb2Vc6X' },
      ],
      ['one outside the rules', { op: 'transform', form: 'Fx0aA1bB2cC3dD4e' }],
      [
        'one Foundry no longer finds',
        { op: 'transform', form: 'Gn0aA1bB2cC3dD4e' },
      ],
    ])('refuses a change into %s as form', (_name, input) => {
      const sheet = elowen({
        wildShape: wildShapeBlock({
          known: [
            ...wildShapeBlock().known,
            { id: 'Zq0Lm4Tn8Rb2Vc6X', name: 'Giant Elk', pool: false },
            knownForm({
              id: 'Fx0aA1bB2cC3dD4e',
              name: 'Giant Bat',
              fits: false,
            }),
            knownForm({
              id: 'Gn0aA1bB2cC3dD4e',
              name: 'Giant Goat',
              found: false,
            }),
          ],
        }),
      })
      expect(checkWildShape(input as WildShapeInput, sheet)).toBe('form')
    })

    it('refuses a change into the form she is in now as form', () => {
      expect(checkWildShape(INTO_WOLF, shapedSheet())).toBe('form')
    })

    it('refuses a change from another kind of transformation as transformed, after the form', () => {
      const polymorphed = shapedSheet({
        form: wolfForm({
          kind: 'other',
          name: 'Giant Ape',
          profile: null,
          hours: null,
          minutesLeft: null,
        }),
      })
      expect(checkWildShape(INTO_WOLF, polymorphed)).toBe('transformed')
      // A 2014 Wild Shape, which ends in Foundry, likewise.
      expect(
        checkWildShape(
          INTO_BEAR,
          shapedSheet({ form: wolfForm({ hours: null, minutesLeft: null }) }),
        ),
      ).toBe('transformed')
      // Not a known form usable from here comes first.
      expect(
        checkWildShape(
          { op: 'transform', form: 'Ab0cD1eF2gH3iJ4k' },
          polymorphed,
        ),
      ).toBe('form')
    })

    it.each([
      ['at 0 hit points with no uses left', 0, 0],
      ['with hit points and no uses left', 31, 0],
      ['at 0 hit points with uses left', 0, 2],
    ])(
      'refuses a change from a Polymorph %s as transformed, before incapacitated and consume',
      (_name, hp, uses) => {
        const polymorphed = shapedSheet({
          hp: { value: hp, max: 38, temp: 0 },
          form: wolfForm({
            kind: 'other',
            name: 'Giant Ape',
            profile: null,
            hours: null,
            minutesLeft: null,
          }),
          wildShape: wildShapeBlock({ uses: { value: uses, max: 2 } }),
        })
        expect(checkWildShape(INTO_BEAR, polymorphed)).toBe('transformed')
      },
    )

    it('refuses a change while Incapacitated, at 0 hit points or dead, before the uses', () => {
      const none = wildShapeBlock({ uses: { value: 0, max: 2 } })
      expect(
        checkWildShape(
          INTO_WOLF,
          elowen({ hp: { value: 0, max: 38, temp: 0 }, wildShape: none }),
        ),
      ).toBe('incapacitated')
      expect(
        checkWildShape(
          INTO_WOLF,
          elowen({
            conditions: [condition('paralyzed'), condition('incapacitated')],
          }),
        ),
      ).toBe('incapacitated')
      expect(
        checkWildShape(
          INTO_BEAR,
          shapedSheet({ conditions: [condition('dead')] }),
        ),
      ).toBe('incapacitated')
    })

    it('refuses a change with no use left as consume', () => {
      expect(
        checkWildShape(
          INTO_WOLF,
          elowen({ wildShape: wildShapeBlock({ uses: { value: 0, max: 2 } }) }),
        ),
      ).toBe('consume')
    })

    it('takes a return from a 2024 Wild Shape, and refuses one while herself or from another kind', () => {
      expect(checkWildShape(RETURN, shapedSheet())).toBeUndefined()
      expect(checkWildShape(RETURN, elowen())).toBe('not-shaped')
      expect(
        checkWildShape(
          RETURN,
          shapedSheet({ form: wolfForm({ kind: 'other', hours: null }) }),
        ),
      ).toBe('transformed')
    })

    it('lists the Beasts to learn wherever she has her Wild Shape, shaped or not, with no uses', () => {
      expect(checkWildShape(FORMS, elowen())).toBeUndefined()
      expect(checkWildShape(FORMS, shapedSheet())).toBeUndefined()
      expect(
        checkWildShape(
          FORMS,
          elowen({
            wildShape: wildShapeBlock({
              uses: { value: 0, max: 2 },
              known: [],
            }),
          }),
        ),
      ).toBeUndefined()
    })

    it('takes a Beast learned into an empty place, and refuses one with every place taken as full', () => {
      const five = wildShapeBlock().known.slice(0, 5)
      expect(
        checkWildShape(
          learn(null),
          elowen({ wildShape: wildShapeBlock({ known: five }) }),
        ),
      ).toBeUndefined()
      expect(
        checkWildShape(
          learn(null),
          elowen({ wildShape: wildShapeBlock({ known: [] }) }),
        ),
      ).toBeUndefined()
      expect(checkWildShape(learn(null), elowen())).toBe('full')
      // More than her count, put there in Foundry, is full too.
      expect(
        checkWildShape(
          learn(null),
          elowen({
            wildShape: wildShapeBlock({
              known: [...wildShapeBlock().known, KNOWN_FORMS.brownBear],
            }),
          }),
        ),
      ).toBe('full')
    })

    it('takes a replacement after a Long Rest, and refuses one of no known form, of the form she is in, or with none free', () => {
      const swapping = wildShapeBlock({ swap: true })
      expect(
        checkWildShape(
          learn(FORM_IDS.panther),
          elowen({ wildShape: swapping }),
        ),
      ).toBeUndefined()
      expect(
        checkWildShape(
          learn('Ab0cD1eF2gH3iJ4k'),
          elowen({ wildShape: swapping }),
        ),
      ).toBe('form')
      expect(
        checkWildShape(
          learn(FORM_IDS.wolf),
          shapedSheet({ wildShape: swapping }),
        ),
      ).toBe('shaped')
      expect(checkWildShape(learn(FORM_IDS.panther), elowen())).toBe('swap')
      // Shaped, another of her known forms may be replaced.
      expect(
        checkWildShape(
          learn(FORM_IDS.panther),
          shapedSheet({ wildShape: swapping }),
        ),
      ).toBeUndefined()
    })

    it('refuses a replacement of the form she is in as shaped before swap, with no replacement free', () => {
      expect(shapedSheet().wildShape?.swap).toBe(false)
      expect(checkWildShape(learn(FORM_IDS.wolf), shapedSheet())).toBe('shaped')
    })

    describe('a known form with no name, as dnd5e leaves one dropped on her Wild Shape in Foundry', () => {
      /** Elowen's sheet as the events route keeps it, read as the module sent it. */
      const kept = (known: KnownForm[], fields: Partial<SheetWildShape> = {}) =>
        (
          parseGameEvent('character.updated', {
            character: {
              id: 'actorElowen1',
              name: 'Elowen',
              sheet: elowen({
                wildShape: wildShapeBlock({ known, ...fields }),
              }),
            },
          })?.data as { character: { sheet: CharacterSheet } }
        ).character.sheet
      const fromElsewhere: KnownForm = {
        id: 'Zq0Lm4Tn8Rb2Vc6X',
        name: '',
        pool: false,
      }
      const notLoaded: KnownForm = {
        id: FORM_IDS.reefShark,
        uuid: KNOWN_FORMS.reefShark.uuid,
        name: '',
        pool: true,
        fits: true,
      }
      const notFound: KnownForm = { ...notLoaded, fits: false, found: false }
      const five = wildShapeBlock().known.slice(0, 5)

      it.each([
        ['from elsewhere', fromElsewhere],
        ['not loaded yet', notLoaded],
        ['not found', notFound],
      ])(
        'counts one %s as the game does, refusing a Beast learned into its place as full',
        (_name, nameless) => {
          const sheet = kept([...five, nameless])
          expect(sheet.wildShape?.known).toHaveLength(6)
          expect(checkWildShape(learn(null), sheet)).toBe('full')
          // And replaces it after a Long Rest, as any known form.
          expect(
            checkWildShape(
              learn(nameless.id),
              kept([...five, nameless], { swap: true }),
            ),
          ).toBeUndefined()
        },
      )

      it('never takes one from elsewhere or not found from here, but one the game hasn’t loaded yet', () => {
        const sheet = kept([...five.slice(0, 3), fromElsewhere, notFound])
        expect(
          checkWildShape({ op: 'transform', form: fromElsewhere.id }, sheet),
        ).toBe('form')
        expect(
          checkWildShape({ op: 'transform', form: notFound.id }, sheet),
        ).toBe('form')
        expect(
          checkWildShape(
            { op: 'transform', form: notLoaded.id },
            kept([...five.slice(0, 3), notLoaded]),
          ),
        ).toBeUndefined()
      })
    })
  })

  describe('articled', () => {
    it.each([
      ['Wolf', 'a Wolf'],
      ['Ape', 'an Ape'],
      ['Owl', 'an Owl'],
      ['elk', 'an elk'],
      ['Giant Elk', 'a Giant Elk'],
    ])('reads %s as %s', (name, words) => {
      expect(articled(name)).toBe(words)
    })

    // Every Beast of dnd5e's 2024 Actors (dnd5e.actors24) within CR 1, as dnd5e 5.3.3's own data
    // names them, each pinned, so a name the first-letter rule reads wrongly is seen here.
    it.each([
      ['Baboon', 'a Baboon'],
      ['Badger', 'a Badger'],
      ['Bat', 'a Bat'],
      ['Cat', 'a Cat'],
      ['Crab', 'a Crab'],
      ['Deer', 'a Deer'],
      ['Eagle', 'an Eagle'],
      ['Frog', 'a Frog'],
      ['Giant Fire Beetle', 'a Giant Fire Beetle'],
      ['Giant Fly', 'a Giant Fly'],
      ['Goat', 'a Goat'],
      ['Hawk', 'a Hawk'],
      ['Hyena', 'a Hyena'],
      ['Jackal', 'a Jackal'],
      ['Lizard', 'a Lizard'],
      ['Octopus', 'an Octopus'],
      ['Owl', 'an Owl'],
      ['Piranha', 'a Piranha'],
      ['Rat', 'a Rat'],
      ['Raven', 'a Raven'],
      ['Scorpion', 'a Scorpion'],
      ['Seahorse', 'a Seahorse'],
      ['Spider', 'a Spider'],
      ['Vulture', 'a Vulture'],
      ['Weasel', 'a Weasel'],
      ['Blood Hawk', 'a Blood Hawk'],
      ['Camel', 'a Camel'],
      ['Giant Crab', 'a Giant Crab'],
      ['Giant Rat', 'a Giant Rat'],
      ['Giant Weasel', 'a Giant Weasel'],
      ['Mastiff', 'a Mastiff'],
      ['Mule', 'a Mule'],
      ['Pony', 'a Pony'],
      ['Venomous Snake', 'a Venomous Snake'],
      ['Boar', 'a Boar'],
      ['Constrictor Snake', 'a Constrictor Snake'],
      ['Draft Horse', 'a Draft Horse'],
      ['Elk', 'an Elk'],
      ['Giant Badger', 'a Giant Badger'],
      ['Giant Bat', 'a Giant Bat'],
      ['Giant Centipede', 'a Giant Centipede'],
      ['Giant Frog', 'a Giant Frog'],
      ['Giant Lizard', 'a Giant Lizard'],
      ['Giant Venomous Snake', 'a Giant Venomous Snake'],
      ['Giant Wolf Spider', 'a Giant Wolf Spider'],
      ['Goat of Traveling', 'a Goat of Traveling'],
      ['Panther', 'a Panther'],
      ['Phantom Steed', 'a Phantom Steed'],
      ['Pteranodon', 'a Pteranodon'],
      ['Riding Horse', 'a Riding Horse'],
      ['Swarm of Bats', 'a Swarm of Bats'],
      ['Swarm of Rats', 'a Swarm of Rats'],
      ['Swarm of Ravens', 'a Swarm of Ravens'],
      ['Wolf', 'a Wolf'],
      ['Ape', 'an Ape'],
      ['Black Bear', 'a Black Bear'],
      ['Crocodile', 'a Crocodile'],
      ['Giant Goat', 'a Giant Goat'],
      ['Giant Seahorse', 'a Giant Seahorse'],
      ['Giant Wasp', 'a Giant Wasp'],
      ['Reef Shark', 'a Reef Shark'],
      ['Swarm of Insects', 'a Swarm of Insects'],
      ['Warhorse', 'a Warhorse'],
      ['Brown Bear', 'a Brown Bear'],
      ['Dire Wolf', 'a Dire Wolf'],
      ['Giant Hyena', 'a Giant Hyena'],
      ['Giant Octopus', 'a Giant Octopus'],
      ['Giant Spider', 'a Giant Spider'],
      ['Giant Toad', 'a Giant Toad'],
      ['Lion', 'a Lion'],
      ['Swarm of Piranhas', 'a Swarm of Piranhas'],
      ['Tiger', 'a Tiger'],
    ])('reads the 2024 %s as %s', (name, words) => {
      expect(articled(name)).toBe(words)
    })
  })

  describe('hoursWords', () => {
    it('says 1 hour, and 2 hours', () => {
      expect(hoursWords(1)).toBe('1 hour')
      expect(hoursWords(2)).toBe('2 hours')
      expect(hoursWords(10)).toBe('10 hours')
    })
  })

  describe('timeLeftWords', () => {
    it.each([
      [118, '1 h 58 m left'],
      [120, '2 h 0 m left'],
      [60, '1 h 0 m left'],
      [59, '59 m left'],
      [30, '30 m left'],
      [1, '1 m left'],
      [0, 'Less than a minute left'],
    ])('says %s minutes as %s', (minutes, words) => {
      expect(timeLeftWords(minutes)).toBe(words)
    })

    it('says nothing where the module doesn’t time the form', () => {
      expect(timeLeftWords(null)).toBeUndefined()
      expect(timeLeftWords()).toBeUndefined()
      expect(timeLeftWords(Number.NaN)).toBeUndefined()
    })
  })
})
