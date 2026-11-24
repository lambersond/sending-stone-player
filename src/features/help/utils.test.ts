import { helpBox, helpSections } from './utils'
import { druidSheet, shapedSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { HelpFacts } from './types'
import type { TableView } from '@/types/table'

const GAME = 'https://my-game.forge-vtt.com'

/** A campaign that takes nothing from its players, live. */
const quiet = (fields: Partial<TableView> = {}): TableView => ({
  version: 1,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  connected: true,
  messages: [],
  ...fields,
})

/**
 * One that takes everything module 0.44.0 does, with dice asks, under dnd5e 5, its hello saying it
 * asks for the dice an item rolls later.
 */
const everything = (fields: Partial<TableView> = {}): TableView =>
  quiet({
    rollsToTable: [
      'skill',
      'save',
      'attack',
      'use',
      'plainRoll',
      'endTurn',
      'dice',
    ],
    rollFeatures: ['prompts', 'effectDice'],
    moves: { parties: [], characters: [] },
    coins: { change: true },
    removes: true,
    favorites: true,
    effects: true,
    wildShape: true,
    hitPoints: true,
    laterDice: true,
    // Changed on purpose (item 58): from module 0.50.0, how hurt other creatures are.
    health: 'health',
    ...fields,
  })

const facts = (fields: Partial<HelpFacts> = {}): HelpFacts => ({
  gm: false,
  name: 'Thorin',
  playing: true,
  view: quiet(),
  send: true,
  ...fields,
})

/** The box's rows as "label: says", a filled or hollow dot first. */
const rowsOf = (shown: HelpFacts) =>
  helpBox(shown)?.rows.map(
    ({ label, says, on }) => `${on ? '●' : '○'} ${label}: ${says}`,
  )

describe('features/help/utils', () => {
  describe('helpBox', () => {
    it('is there only while the character plays in its campaign', () => {
      expect(helpBox(facts({ playing: false }))).toBeUndefined()
      expect(helpBox(facts())?.title).toBe('In this game, for Thorin')
    })

    it.each<[string, HelpFacts, string[]]>([
      [
        'a campaign that takes everything, typing on',
        facts({ view: everything(), typing: { on: true } }),
        [
          '● Your rolls: Made in your Gamemaster’s game too',
          '● Attacks, spells and features: Made in the game',
          '● Saves the game asks: Asked here',
          '● Dice tray: Rolled in the game too',
          '● End turn: From here',
          '● Typing in your dice: On',
          '● Dice your effects add: Asked for',
          '● Dice an item rolls later: Asked for',
          '● Hit points: Set from here',
          '● Moving items and coins: From here',
          '● Adding and removing coins: From here',
          '● Removing items: From here',
          '● Favorites: From here',
          '● Your own effects: From here',
          // Changed on purpose (item 58): last, from module 0.50.0.
          '● Other creatures’ health: How hurt they are',
        ],
      ],
      [
        'a campaign that takes everything, typing on, while this device’s Send to the table is off, a druid’s',
        facts({
          view: everything({ sheet: toTableSheet(druidSheet(), GAME) }),
          typing: { on: true },
          send: false,
        }),
        [
          '○ Your rolls: Stay here: only you see them',
          '○ Attacks, spells and features: Stay here',
          '○ Saves the game asks: Asked in Foundry',
          '○ Dice tray: Rolls here only',
          '○ End turn: Not from here',
          '● Typing in your dice: On',
          '○ Dice your effects add: Not while Send is off',
          '○ Dice an item rolls later: Not while Send is off',
          '● Hit points: Set from here',
          '● Moving items and coins: From here',
          '● Adding and removing coins: From here',
          '● Removing items: From here',
          '● Favorites: From here',
          '● Your own effects: From here',
          '● Wild Shape: From here',
          // Changed on purpose (item 58): after Wild Shape, from module 0.50.0.
          '● Other creatures’ health: How hurt they are',
        ],
      ],
      [
        'a campaign that takes nothing, typing not offered',
        facts(),
        [
          '○ Your rolls: Stay here: only you see them',
          '○ Attacks, spells and features: Stay here',
          '○ Saves the game asks: Asked in Foundry',
          '○ Dice tray: Rolls here only',
          '○ End turn: Not from here',
          '○ Typing in your dice: Not in this game',
          '○ Hit points: Not from here',
          '○ Moving items and coins: Not from here',
          '○ Adding and removing coins: Not from here',
          '○ Removing items: Not from here',
          '○ Favorites: Not from here',
          '○ Your own effects: Not from here',
          // Changed on purpose (item 58): last, from module 0.50.0.
          '○ Other creatures’ health: Not shown',
        ],
      ],
    ])('says what %s allows the player', (_case, shown, rows) => {
      expect(rowsOf(shown)).toEqual(rows)
    })

    it.each<[string, HelpFacts['typing'], string[]]>([
      ['not offered', undefined, ['○ Typing in your dice: Not in this game']],
      [
        'allowed but off',
        { on: false },
        ['● Typing in your dice: Allowed: turn it on in Settings'],
      ],
      [
        'on',
        { on: true },
        [
          '● Typing in your dice: On',
          '○ Dice your effects add: Rolled by the game',
          '● Dice an item rolls later: Asked for',
        ],
      ],
    ])(
      'says typing is %s, and the dice it asks for only while it is on',
      (_case, typing, rows) => {
        const view = quiet({ rollsToTable: ['skill', 'dice'], laterDice: true })
        const shown = rowsOf(facts({ view, typing }))
        expect(shown?.filter(row => /Typing|Dice (your|an)/.test(row))).toEqual(
          rows,
        )
      },
    )

    it.each<[string, TableView, string[]]>([
      [
        'is one that asks for them, and takes the answer now',
        everything(),
        ['● Dice an item rolls later: Asked for'],
      ],
      [
        'is one that asks for them, but takes none now, as its switches or a game not polling leave it',
        everything({ rollsToTable: [], rollFeatures: [] }),
        ['○ Dice an item rolls later: Rolled by the game'],
      ],
      ['is none that asks for them', everything({ laterDice: undefined }), []],
    ])(
      'has the row for the dice an item rolls later only where the campaign’s module %s',
      (_case, view, rows) => {
        const shown = rowsOf(facts({ view, typing: { on: true } }))
        expect(shown?.filter(row => row.includes('an item rolls'))).toEqual(
          rows,
        )
      },
    )

    it('takes nothing as made in the game for a character no longer among its campaign’s', () => {
      const rows = rowsOf(facts({ view: everything({ connected: false }) }))
      expect(rows?.slice(0, 5).every(row => row.startsWith('○'))).toBe(true)
    })

    it.each([
      ['a druid with Wild Shape', druidSheet(), '● Wild Shape: From here'],
      ['one shaped now', shapedSheet(), '● Wild Shape: From here'],
    ])('has Wild Shape’s row for %s alone', (_case, sheet, row) => {
      // Changed on purpose (item 58): other creatures' health comes after it, last.
      const view = everything({ sheet: toTableSheet(sheet, GAME) })
      expect(rowsOf(facts({ view }))?.at(-2)).toBe(row)
      expect(
        rowsOf(
          facts({
            view: everything({ wildShape: undefined, sheet: view.sheet }),
          }),
        )?.at(-2),
      ).toBe('○ Wild Shape: Not from here')
    })

    it.each<[string, TableView['health'], string]>([
      [
        'how hurt they are',
        'health',
        '● Other creatures’ health: How hurt they are',
      ],
      [
        'their hit points',
        'hitPoints',
        '● Other creatures’ health: Their hit points',
      ],
      ['nothing', undefined, '○ Other creatures’ health: Not shown'],
    ])(
      'says other creatures’ health shows %s at either seat (module 0.50.0)',
      (_case, health, row) => {
        const view = everything({ health, gm: { rolls: 'made' } })
        expect(rowsOf(facts({ view }))?.at(-1)).toBe(row)
        expect(rowsOf(facts({ view, gm: true }))?.at(-1)).toBe(row)
      },
    )

    it('says why something may be missing, and while the game is not connected that nothing is made there', () => {
      expect(helpBox(facts())?.notes).toEqual([
        {
          text: 'Missing something? Most of these are your Gamemaster’s switches in Foundry. Some need a newer Sending Stone module, or a different setup there. Ask them.',
        },
      ])
      expect(
        helpBox(facts({ view: quiet({ live: false }) }))?.notes[1],
      ).toEqual({
        text: 'Your Gamemaster’s game isn’t connected right now, so nothing is made there.',
        warn: true,
      })
    })

    it.each([
      [
        'made',
        true,
        '● Your rolls here: Made in your game as Thorin, marked GM',
      ],
      ['made', false, '○ Your rolls here: Stay here: only you see them'],
      [
        'update',
        true,
        '○ Your rolls here: Stay here until your Sending Stone module is updated',
      ],
      [
        'off',
        true,
        '○ Your rolls here: Stay here: your game takes no rolls now',
      ],
    ] as const)(
      'tells the Gamemaster where their rolls go, %s, Send to the table on here: %s, and what they may move, change and remove',
      (rolls, send, row) => {
        const shown = facts({
          gm: true,
          send,
          view: everything({ gm: { rolls }, removes: undefined }),
        })
        expect(rowsOf(shown)).toEqual([
          row,
          '● Moving items and coins: From here',
          // Changed on purpose (item 67): coins added and taken away, from module 0.49.0.
          '● Adding and removing coins: From here',
          '○ Removing items: Not from here',
          // Changed on purpose (item 58): other creatures' health, from module 0.50.0.
          '● Other creatures’ health: How hurt they are',
        ])
        expect(helpBox(shown)?.notes).toEqual([
          {
            text: 'Your switches are on the Player actions tab of Sending Stone’s settings in Foundry.',
          },
        ])
      },
    )
  })

  describe('the dice an item rolls later (H6 B)', () => {
    it('describes them only where the game asks for them, every other part kept', () => {
      const typingOf = (laterDice: boolean) =>
        helpSections({
          laterDice,
          companionsAway: true,
          companionsConstant: true,
        })
          .find(({ id }) => id === 'typing')
          ?.parts.map(({ lead }) => lead)
      expect(typingOf(true)).toContain('Dice an item rolls later.')
      expect(typingOf(false)).toEqual(
        typingOf(true)?.filter(lead => lead !== 'Dice an item rolls later.'),
      )
      // Changed on purpose (item 58): Combat's part on other creatures' health, and its two
      // switches, from module 0.50.0; and (item 36) Combat's part on two encounters at once.
      // Changed on purpose (item 18): and the rolls' part on companions elsewhere, from module
      // 0.51.0.
      // Changed on purpose (item 98): and its part on constant companions, from module 0.54.0.
      expect(
        helpSections({
          laterDice: false,
          companionsAway: true,
          companionsConstant: true,
        }).map(({ parts }) => parts.length),
      ).toEqual([10, 7, 1, 7, 3, 3, 10, 16])
    })
  })

  // Module 0.51.0 (item 18): "Companions elsewhere." where the module lists companions on every
  // scene, after "Companions and conditions.", whatever the dice an item rolls later.
  describe('companions on another scene', () => {
    it.each([true, false])(
      'describes them only where the module lists them there, the dice an item rolls later %p',
      laterDice => {
        const leadsOf = (companionsAway: boolean) =>
          helpSections({
            laterDice,
            companionsAway,
            companionsConstant: true,
          }).flatMap(({ parts }) => parts.map(({ lead }) => lead))
        const shown = leadsOf(true)
        expect(shown[shown.indexOf('Companions and conditions.') + 1]).toBe(
          'Companions elsewhere.',
        )
        expect(leadsOf(false)).toEqual(
          shown.filter(lead => lead !== 'Companions elsewhere.'),
        )
        expect(shown.includes('Dice an item rolls later.')).toBe(laterDice)
      },
    )
  })

  // Module 0.54.0 (item 98): "Constant companions." where the module lists the Gamemaster's
  // constant companions, after the companions' other parts, whatever the other two say.
  describe('constant companions', () => {
    it.each([
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ])(
      'describes them only where the module lists them, the dice an item rolls later %p and companions elsewhere %p',
      (laterDice, companionsAway) => {
        const leadsOf = (companionsConstant: boolean) =>
          helpSections({
            laterDice,
            companionsAway,
            companionsConstant,
          }).flatMap(({ parts }) => parts.map(({ lead }) => lead))
        const shown = leadsOf(true)
        const before = companionsAway
          ? 'Companions elsewhere.'
          : 'Companions and conditions.'
        expect(shown[shown.indexOf(before) + 1]).toBe('Constant companions.')
        expect(leadsOf(false)).toEqual(
          shown.filter(lead => lead !== 'Constant companions.'),
        )
        expect(shown.includes('Companions elsewhere.')).toBe(companionsAway)
      },
    )
  })
})
