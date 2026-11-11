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
    removes: true,
    favorites: true,
    effects: true,
    wildShape: true,
    hitPoints: true,
    laterDice: true,
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
          '● Removing items: From here',
          '● Favorites: From here',
          '● Your own effects: From here',
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
          '○ Removing items: Not from here',
          '○ Favorites: Not from here',
          '○ Your own effects: Not from here',
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
        'asks for them, and takes the answer now',
        everything(),
        ['● Dice an item rolls later: Asked for'],
      ],
      [
        'asks for them, but the game isn’t polling now',
        everything({ rollsToTable: [], rollFeatures: [] }),
        ['○ Dice an item rolls later: Rolled by the game'],
      ],
      ['asks for none', everything({ laterDice: undefined }), []],
    ])(
      'has the row for the dice an item rolls later only where the campaign’s module %s',
      (_case, view, rows) => {
        const shown = rowsOf(facts({ view, typing: { on: true } }))
        expect(shown?.filter(row => row.includes('an item rolls'))).toEqual(
          rows,
        )
      },
    )

    it('says the rolls made, rolled or ended in the game stay here while this device’s Send to the table is off', () => {
      const rows = rowsOf(facts({ view: everything(), send: false }))
      expect(rows?.slice(0, 5)).toEqual([
        '○ Your rolls: Stay here: only you see them',
        '○ Attacks, spells and features: Stay here',
        '● Saves the game asks: Asked here',
        '○ Dice tray: Rolls here only',
        '○ End turn: Not from here',
      ])
    })

    it('takes nothing as made in the game for a character no longer among its campaign’s', () => {
      const rows = rowsOf(facts({ view: everything({ connected: false }) }))
      expect(rows?.slice(0, 5).every(row => row.startsWith('○'))).toBe(true)
    })

    it.each([
      ['a druid with Wild Shape', druidSheet(), '● Wild Shape: From here'],
      ['one shaped now', shapedSheet(), '● Wild Shape: From here'],
    ])('has Wild Shape’s row for %s alone', (_case, sheet, row) => {
      const view = everything({ sheet: toTableSheet(sheet, GAME) })
      expect(rowsOf(facts({ view }))?.at(-1)).toBe(row)
      expect(
        rowsOf(
          facts({
            view: everything({ wildShape: undefined, sheet: view.sheet }),
          }),
        )?.at(-1),
      ).toBe('○ Wild Shape: Not from here')
    })

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
      'tells the Gamemaster where their rolls go, %s, Send to the table on here: %s, and what they may move and remove',
      (rolls, send, row) => {
        const shown = facts({
          gm: true,
          send,
          view: everything({ gm: { rolls }, removes: undefined }),
        })
        expect(rowsOf(shown)).toEqual([
          row,
          '● Moving items and coins: From here',
          '○ Removing items: Not from here',
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
        helpSections(laterDice)
          .find(({ id }) => id === 'typing')
          ?.parts.map(({ lead }) => lead)
      expect(typingOf(true)).toContain('Dice an item rolls later.')
      expect(typingOf(false)).toEqual(
        typingOf(true)?.filter(lead => lead !== 'Dice an item rolls later.'),
      )
      expect(helpSections(false).map(({ parts }) => parts.length)).toEqual([
        8, 7, 1, 7, 3, 1, 10, 12,
      ])
    })
  })
})
