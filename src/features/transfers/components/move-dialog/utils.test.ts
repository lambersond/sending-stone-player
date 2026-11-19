import {
  coinsLegend,
  eachMove,
  eachSummary,
  firstChosen,
  givesEach,
  partiesOf,
  pickedOf,
  severalOf,
  toldWords,
} from './utils'
import { coinSpeaker } from '@/features/transfers/utils'
import { purse } from '@/mocks/sending-stone'
import type { MoveEnd } from '@/features/transfers/types'

// The rules of a character's Give of its coins to characters (module 0.49.0), which were the Hand
// out dialog's (item 89): MoveDialog only wires them.

const VEX = { id: 'actorVex0001', name: 'Vex' }
const BRAM = { id: 'actorBram001', name: 'Bram' }
const LIA = { id: 'actorLia0001', name: 'Lia' }
const PARTY = { id: 'groupIronCo01', name: 'The Iron Company', primary: true }
const ABBREVIATIONS = { pp: 'pp', gp: 'gp', ep: 'ep', sp: 'sp', cp: 'cp' }
/** Thorin's coins: 700 pp and 20 gp, as the sheet had them. */
const HELD = purse({ pp: 700, gp: 20 })
const PLAYER = coinSpeaker('player', 'Thorin')
const GM = coinSpeaker('gm', 'Thorin')

describe('features/transfers/move-dialog/utils, a give of coins to characters, from module 0.49.0', () => {
  it.each<
    [
      string,
      MoveEnd[],
      Record<string, number> | undefined,
      { held?: ReturnType<typeof purse>; change?: boolean; gm?: boolean },
      string,
      boolean,
    ]
  >([
    ['no one ticked', [], { gp: 5 }, {}, 'Choose who gets it.', false],
    [
      'more than one give goes to',
      Array.from({ length: 21 }, (_, index) => ({
        id: `actor${index}`,
        name: `Character ${index}`,
      })),
      { gp: 1 },
      {},
      'Choose up to 20 at a time.',
      false,
    ],
    ['one, no coins typed', [VEX], undefined, {}, 'Choose how many.', false],
    [
      'several, no coins typed',
      [VEX, BRAM],
      undefined,
      {},
      'Choose how many each gets.',
      false,
    ],
    ['one', [VEX], { gp: 5 }, {}, 'You give 5 gp to Vex.', true],
    [
      'several, what each gets and what that is in all',
      [VEX, BRAM],
      { gp: 2 },
      {},
      'You give 2 gp each to Vex and Bram: 4 gp in all.',
      true,
    ],
    [
      'one, more of a coin than is held, which other coins pay',
      [VEX],
      { gp: 50 },
      {},
      'You give 50 gp to Vex. You hold only 20 gp, so other coins pay for the rest.',
      true,
    ],
    [
      'one, more than the coins are worth',
      [VEX],
      { pp: 800 },
      {},
      'You haven’t that much: 800 pp is more than your coins are worth.',
      false,
    ],
    [
      'several, more than the coins are worth in all',
      [VEX, BRAM, LIA],
      { pp: 300 },
      {},
      'You haven’t that much: 900 pp in all is more than your coins are worth.',
      false,
    ],
    [
      'one, more of a coin than is held, where the game pays with no other',
      [VEX],
      { gp: 21 },
      { change: false },
      'You hold only 20 gp, and your Gamemaster’s game doesn’t pay with other coins.',
      false,
    ],
    [
      'several, more of a coin than is held in all, where the game pays with no other',
      [VEX, BRAM, LIA],
      { pp: 250 },
      { change: false },
      'You hold only 700 pp of the 750 pp in all, and your Gamemaster’s game doesn’t pay with other coins.',
      false,
    ],
    [
      'the Gamemaster’s, to several',
      [VEX, BRAM],
      { gp: 2 },
      { gm: true },
      'Thorin gives 2 gp each to Vex and Bram: 4 gp in all.',
      true,
    ],
    [
      'the Gamemaster’s, more than the character’s coins are worth',
      [VEX],
      { pp: 800 },
      { gm: true },
      'Thorin hasn’t that much: 800 pp is more than their coins are worth.',
      false,
    ],
  ])(
    'says what it’ll do, or what it needs: %s',
    (_name, to, each, { held = HELD, change = true, gm }, said, ready) => {
      const {
        text,
        note,
        ready: sendable,
      } = eachSummary(to, each, held, change, gm ? GM : PLAYER)
      expect([text, note].filter(Boolean).join(' ')).toBe(said)
      expect(sendable).toBe(ready)
    },
  )

  it('sends a give to one as a give to them, and to several as what each gets, with the sheet’s abbreviations', () => {
    expect(
      eachMove([VEX], { gp: 5 }, HELD, { name: 'Thorin', gm: false }),
    ).toEqual({
      each: [VEX.id],
      currency: { gp: 5 },
      words: {
        verb: 'give',
        things: '5 gp',
        other: 'Vex',
        abbreviations: ABBREVIATIONS,
      },
    })
    expect(
      eachMove([VEX, BRAM, LIA], { pp: 200, gp: 50 }, HELD, {
        name: 'Thorin',
        gm: true,
      }),
    ).toEqual({
      each: [VEX.id, BRAM.id, LIA.id],
      currency: { pp: 200, gp: 50 },
      words: {
        verb: 'handOut',
        things: '200 pp and 50 gp',
        other: 'Thorin',
        among: 'Vex, Bram, and Lia',
        mover: 'Thorin',
        abbreviations: ABBREVIATIONS,
      },
    })
  })

  it.each([
    ['a character’s coins, no one picked', { chosen: [] }, true],
    ['a character’s coins, characters picked', { chosen: [VEX.id] }, true],
    ['a character’s coins, a party picked', { chosen: [PARTY.id] }, false],
    ['an item', { chosen: [VEX.id], currency: undefined }, false],
    [
      'coins, where the module hands none out',
      { chosen: [VEX.id], handOut: undefined },
      false,
    ],
  ])('gives as the game hands coins out: %s', (_name, given, gives) => {
    expect(
      givesEach({
        handOut: { change: true, name: 'Thorin', onGive: jest.fn() },
        currency: HELD,
        parties: [PARTY],
        ...given,
      }),
    ).toBe(gives)
  })

  it('calls what each gets so for several only', () => {
    expect([0, 1, 2, 20].map(count => coinsLegend(count))).toEqual([
      'Coins',
      'Coins',
      'Each gets',
      'Each gets',
    ])
  })

  it('says who’s told: everyone of a give to one end, else a whisper to each and the Gamemasters', () => {
    expect(toldWords({ each: false, to: [PARTY], gm: false })).toBe(
      'Foundry’s chat will say so.',
    )
    expect(toldWords({ each: true, to: [VEX], gm: false })).toBe(
      'Vex is whispered what they received in Foundry’s chat, and your Gamemaster is told.',
    )
    expect(toldWords({ each: true, to: [VEX, BRAM], gm: true })).toBe(
      'Each is whispered what they received in Foundry’s chat, and you are told.',
    )
  })

  it('keeps those picked in the list’s order, or the set receiver where there’s no list', () => {
    expect(pickedOf([PARTY, VEX, BRAM], [BRAM.id, VEX.id])).toEqual([VEX, BRAM])
    expect(pickedOf(undefined, [], PARTY)).toEqual([PARTY])
    expect(pickedOf(undefined, [])).toEqual([])
  })
})

describe('features/transfers/move-dialog/utils, parties given coins as characters are, from module 0.51.0', () => {
  const ORDER = { id: 'groupOrder01', name: 'The Silent Order' }
  const handOut = {
    change: true,
    parties: true as const,
    name: 'Thorin',
    onGive: jest.fn(),
  }

  it.each([
    ['nobody, with no hand-out', undefined, HELD, undefined],
    ['nobody, for an item', handOut, undefined, undefined],
    [
      'the characters (module 0.49.0)',
      { ...handOut, parties: undefined },
      HELD,
      'characters',
    ],
    ['everyone (module 0.51.0)', handOut, HELD, 'everyone'],
  ])('ticks %s', (_name, given, currency, several) => {
    expect(severalOf(given, currency)).toBe(several)
  })

  it('finds the parties among the ends: the list’s, a give’s set receiver, none for a take', () => {
    expect(
      partiesOf({
        mode: 'give',
        recipients: { parties: [PARTY], characters: [VEX] },
      }),
    ).toEqual([PARTY])
    expect(partiesOf({ mode: 'give', into: PARTY })).toEqual([PARTY])
    expect(partiesOf({ mode: 'take', into: VEX })).toEqual([])
  })

  it('opens on no one where everyone may be ticked, and on the primary party before', () => {
    const recipients = { parties: [PARTY], characters: [VEX] }
    expect(
      firstChosen({ mode: 'give', recipients, several: 'everyone' }),
    ).toEqual([])
    expect(
      firstChosen({ mode: 'give', recipients, several: 'characters' }),
    ).toEqual([PARTY.id])
  })

  it.each([[[]], [[PARTY.id]], [[PARTY.id, VEX.id]]])(
    'gives as the game hands coins out with %j chosen',
    chosen => {
      expect(
        givesEach({ handOut, currency: HELD, chosen, parties: [PARTY] }),
      ).toBe(true)
    },
  )

  it.each<[string, MoveEnd[], boolean, string]>([
    ['a party alone', [PARTY], false, 'Foundry’s chat will say so.'],
    ['two parties', [PARTY, ORDER], true, 'Foundry’s chat will say so.'],
    [
      'a party and a character',
      [PARTY, VEX],
      false,
      'Foundry’s chat will say what The Iron Company gets. Vex is whispered what they received, and your Gamemaster is told.',
    ],
    [
      'a party and two characters',
      [PARTY, VEX, BRAM],
      false,
      'Foundry’s chat will say what The Iron Company gets. Each character is whispered what they received, and your Gamemaster is told.',
    ],
    [
      'two parties and a character, at the Gamemaster’s page',
      [PARTY, ORDER, VEX],
      true,
      'Foundry’s chat will say what each party gets. Vex is whispered what they received, and you are told.',
    ],
    [
      'characters alone, as before',
      [VEX, BRAM],
      false,
      'Each is whispered what they received in Foundry’s chat, and your Gamemaster is told.',
    ],
  ])('says who’s told of %s', (_name, to, gm, words) => {
    expect(toldWords({ each: true, to, parties: [PARTY, ORDER], gm })).toBe(
      words,
    )
  })

  it('sends the party in its place in each, first as the list orders it, and the tray names it among them', () => {
    expect(
      eachMove([PARTY, VEX, BRAM], { gp: 2 }, HELD, {
        name: 'Thorin',
        gm: false,
      }),
    ).toEqual({
      each: [PARTY.id, VEX.id, BRAM.id],
      currency: { gp: 2 },
      words: {
        verb: 'handOut',
        things: '2 gp',
        other: 'Thorin',
        among: 'The Iron Company, Vex, and Bram',
        abbreviations: ABBREVIATIONS,
      },
    })
  })
})
