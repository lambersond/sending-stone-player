/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { DiceRendererProvider } from '@lambersond/3d-dice-react'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import {
  biteAction,
  characterSheet,
  mockCreature,
  sheetAction,
  sheetItem,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { RollKind } from '@/types/roll'
import type { CharacterSheet, SheetActionSection } from '@/types/sending-stone'
import type { CreatureFacts, TableCombat } from '@/types/table'

/*
 * A creature's pane (module 0.36.0): its tabs, its header, and how it behaves while another pane is
 * shown. The 3D dice need WebGL, so the renderer is a stand-in, counted as it's made, with no dice
 * ever ready, so that rolls resolve at once; or, where a case says so, ready, each throw counted.
 */
const mockRenderers = jest.fn()
const mockThrows = jest.fn(async () => {})
let mockReady = false
jest.mock('@lambersond/3d-dice-core', () => ({
  ...jest.requireActual('@lambersond/3d-dice-core'),
  DiceRenderer: jest.fn().mockImplementation(() => {
    mockRenderers()
    return {
      get isReady() {
        return mockReady
      },
      subscribe: () => () => {},
      ensure: () => {},
      dispose: () => {},
      roll: mockThrows,
    }
  }),
}))

const GAME = 'https://my-game.forge-vtt.com'

/** Brakka, a wolf Thorin owns. */
const BRAKKA: CreatureFacts = {
  name: 'Brakka',
  relation: { kind: 'owned', of: 'Thorin' },
}

/** A Battle Cry its user's foes save against, out of a fight at no one, its damage to follow. */
const battleCry = sheetAction({
  id: 'cry',
  name: 'Battle Cry',
  save: { ability: 'DEX', dc: 13 },
  damage: [{ formula: '1d6', type: 'Thunder', healing: false }],
  activity: {
    id: 'crySave',
    type: 'save',
    targets: {
      self: false,
      area: false,
      count: 1,
      perLevel: null,
      affects: 'creature',
    },
  },
})

/**
 * Brakka's sheet as module 0.36.0 sends an NPC's: every coin at 0 and no item, its details its
 * alignment alone, and no effect, so that it has no Inventory, Biography or Effects tab.
 */
const wolf = (fields: Partial<CharacterSheet> = {}) =>
  toTableSheet(
    characterSheet({
      level: null,
      classes: [],
      species: null,
      background: null,
      hp: { value: 11, max: 11, temp: 0 },
      ac: 13,
      proficiency: 2,
      initiative: 2,
      inspiration: true,
      creature: mockCreature(),
      inventory: {
        sections: [],
        containers: [],
        currency: [
          { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 0 },
          { id: 'sp', label: 'Silver', abbreviation: 'sp', value: 0 },
        ],
        encumbrance: null,
        attunement: null,
      },
      details: {
        about: [{ id: 'alignment', label: 'Alignment', value: 'Unaligned' }],
        personality: [],
        appearance: null,
        xp: null,
        biography: null,
      },
      effects: [{ id: 'passive', label: 'Passive Effects', effects: [] }],
      actions: [{ id: 'action', label: 'Actions', actions: [battleCry] }],
      ...fields,
    }),
    GAME,
  )

const clearStorage = (toasts: 'on' | 'off') => {
  globalThis.localStorage.clear()
  globalThis.sessionStorage.clear()
  globalThis.localStorage.setItem(TOASTS_KEY, toasts)
}

/**
 * The game, answering each request by its id as `answers` says at the time, pending otherwise:
 * everything posted, in order.
 */
const answering = (answers: Record<string, Record<string, unknown>>) => {
  const posted: Record<string, unknown>[] = []
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return {
        ok: true,
        status: 202,
        json: async () => ({ id: `req-${posted.length}` }),
      } as Response
    }
    const id = String(url).split('/').at(-1) ?? ''
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, status: 'pending', ...answers[id] }),
    } as Response
  }) as typeof fetch
  return posted
}

type Pane = Partial<Parameters<typeof CharacterPane>[0]>

const pane = (props: Pane = {}) => (
  <CharacterPane
    characterId='seat-1:c:brakka'
    name='Brakka'
    sheet={wolf()}
    creature={BRAKKA}
    idPrefix='creature-brakka-'
    {...props}
  />
)

const tabNames = () =>
  within(screen.getByRole('tablist', { name: 'Character sheet' }))
    .getAllByRole('tab')
    .map(tab => tab.getAttribute('title'))

/** A section of actions, holding one named so. */
const section = (
  id: string,
  label: string,
  name: string,
): SheetActionSection => ({
  id,
  label,
  actions: [sheetAction({ id: `${id}-${name}`, name })],
})

beforeEach(() => {
  clearStorage('off')
  mockRenderers.mockClear()
  mockThrows.mockClear()
  mockReady = false
  globalThis.fetch = jest.fn() as typeof fetch
})

describe('a creature’s pane', () => {
  it('has no Inspiration, no Give, Remove or Journal, and only the tabs it has something for', () => {
    render(
      pane({
        rollsToTable: ['inspiration', 'spend', 'transfer', 'remove'],
      }),
    )
    expect(screen.getByRole('heading', { name: 'Brakka' })).toBeInTheDocument()
    expect(screen.queryByText(/inspired/i)).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Heroic Inspiration/ }),
    ).toBeNull()
    expect(screen.queryByText(/Journal/)).toBeNull()
    expect(tabNames()).toEqual(['Character', 'Actions', 'Features'])
  })

  it('offers no favorites, from module 0.37.0, even where its character’s pane would, as an NPC has none', async () => {
    const user = userEvent.setup()
    const sheet = wolf({
      actions: [{ id: 'action', label: 'Actions', actions: [biteAction()] }],
    })
    render(pane({ sheet, favorites: true }))
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    const name = screen.getByRole('button', { name: /^Bite/, expanded: false })
    expect(fireEvent.contextMenu(name, { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('has Inventory for an item it carries, and not for coins all at 0', () => {
    const { rerender } = render(pane())
    expect(tabNames()).not.toContain('Inventory')
    const sheet = wolf()
    rerender(
      pane({
        sheet: {
          ...sheet,
          inventory: {
            ...sheet.inventory,
            sections: [
              {
                id: 'weapon',
                label: 'Weapons',
                items: [sheetItem({ id: 'axe', name: 'Greataxe' })],
              },
            ],
          },
        },
      }),
    )
    expect(tabNames()).toContain('Inventory')
    rerender(
      pane({
        sheet: {
          ...sheet,
          inventory: {
            ...sheet.inventory,
            currency: [
              { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 3 },
            ],
          },
        },
      }),
    )
    expect(tabNames()).toContain('Inventory')
  })

  it('has Biography for more than its alignment, and Effects for an effect or a condition', () => {
    const sheet = wolf()
    const { rerender } = render(pane())
    expect(tabNames()).not.toContain('Biography')
    expect(tabNames()).not.toContain('Effects')
    rerender(
      pane({
        sheet: {
          ...sheet,
          details: { ...sheet.details, appearance: 'Grey, with one torn ear.' },
        },
      }),
    )
    expect(tabNames()).toContain('Biography')
    rerender(
      pane({
        sheet: {
          ...sheet,
          conditions: [
            {
              id: 'prone',
              name: 'Prone',
              img: null,
              text: null,
            } as unknown as (typeof sheet.conditions)[number],
          ],
        },
      }),
    )
    expect(tabNames()).toContain('Effects')
  })

  it('shows the character’s own tabs at the character’s pane, whatever its sheet holds', () => {
    render(pane({ creature: undefined, idPrefix: undefined }))
    expect(tabNames()).toEqual([
      'Character',
      'Actions',
      'Inventory',
      'Features',
      'Effects',
      'Biography',
    ])
  })

  it('prefixes its tabs’ and panel’s ids, and the character’s pane none', () => {
    const { unmount } = render(pane())
    expect(screen.getByRole('tab', { name: 'Character' })).toHaveAttribute(
      'id',
      'creature-brakka-sheet-tab-character',
    )
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('id', 'creature-brakka-sheet-panel')
    expect(panel).toHaveAttribute(
      'aria-labelledby',
      'creature-brakka-sheet-tab-character',
    )
    expect(screen.getByRole('tab', { name: 'Character' })).toHaveAttribute(
      'aria-controls',
      'creature-brakka-sheet-panel',
    )
    unmount()
    render(pane({ creature: undefined, idPrefix: undefined }))
    expect(screen.getByRole('tab', { name: 'Character' })).toHaveAttribute(
      'id',
      'sheet-tab-character',
    )
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'sheet-panel')
  })

  it('names its sections apart from the character’s, mounted beside it', async () => {
    const user = userEvent.setup()
    render(
      <>
        <div data-testid='thorin'>
          <CharacterPane
            characterId='seat-1'
            name='Thorin'
            sheet={toTableSheet(
              characterSheet({
                actions: [
                  section('action', 'Actions', 'Warhammer'),
                  section('bonus', 'Bonus Actions', 'Second Wind'),
                ],
              }),
              GAME,
            )}
          />
        </div>
        <div data-testid='drake'>
          {pane({
            characterId: 'seat-1:c:drake',
            name: 'Drake',
            creature: { ...BRAKKA, name: 'Drake' },
            idPrefix: 'creature-drake-',
            sheet: wolf({
              actions: [
                section('action', 'Actions', 'Rend'),
                section('legendary', 'Legendary Actions', 'Wing Attack'),
              ],
            }),
          })}
        </div>
      </>,
    )
    const thorin = within(screen.getByTestId('thorin'))
    const drake = within(screen.getByTestId('drake'))
    await user.click(thorin.getByRole('tab', { name: 'Actions' }))
    await user.click(drake.getByRole('tab', { name: 'Actions' }))
    expect(
      drake.getAllByRole('region', { name: 'Legendary Actions' }),
    ).toHaveLength(1)
    expect(thorin.getByRole('region', { name: 'Bonus Actions' })).toBeTruthy()
    const ids = [...document.querySelectorAll('[id]')].map(({ id }) => id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  describe('its initiative right after its character', () => {
    const waiting: TableCombat = {
      id: 'cmbt1',
      name: null,
      started: true,
      round: 1,
      combatants: [
        {
          id: 'c-brakka',
          name: 'Brakka',
          initiative: null,
          defeated: false,
          side: 'me',
        },
      ],
    }

    it('says it acts right after its character, with no roll, as a group named so', () => {
      render(pane({ combat: waiting, follows: 'Thorin' }))
      const group = screen.getByRole('group', {
        name: 'Initiative, +2, acts right after Thorin',
      })
      expect(within(group).getByText('After Thorin')).toBeInTheDocument()
      expect(within(group).queryByText('Roll')).toBeNull()
      expect(screen.queryByRole('button', { name: /^Initiative/ })).toBeNull()
      // The group is in the value, not on the list's own div.
      expect(group.tagName).toBe('SPAN')
      expect(group.closest('dd')).not.toBeNull()
    })

    it('rolls its own as ever without it', () => {
      render(pane({ combat: waiting }))
      expect(
        screen.getByRole('button', {
          name: 'Initiative, +2, to roll for the combat',
        }),
      ).toBeInTheDocument()
      expect(screen.queryByText('After Thorin')).toBeNull()
    })
  })

  describe('with another pane shown', () => {
    const kinds: RollKind[] = ['use', 'damage', 'ability']

    it('pops no toasts', async () => {
      clearStorage('on')
      const user = userEvent.setup()
      render(pane({ shown: false }))
      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      expect(screen.queryByRole('log', { name: 'Roll results' })).toBeNull()
    })

    it('offers a use’s damage rather than rolling it, saying so, and rolls it once shown and tapped', async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': {
          status: 'done',
          visible: true,
          rolls: [],
          use: { type: 'save' },
          damage: {
            critical: false,
            plannable: true,
            rolls: [
              {
                formula: '1d6',
                type: 'thunder',
                dice: [{ faces: 6, number: 1 }],
              },
            ],
          },
        },
        'req-2': { status: 'done', visible: true, total: 4 },
      })
      const onPending = jest.fn()
      const { rerender } = render(
        pane({ shown: false, rollsToTable: kinds, onPending }),
      )
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      await user.click(
        screen.getByRole('button', {
          name: 'Battle Cry, DEX saving throw DC 13',
        }),
      )
      expect(posted[0]).toMatchObject({ kind: 'use', item: 'cry' })
      await waitFor(() => expect(onPending).toHaveBeenLastCalledWith(true), {
        timeout: 3000,
      })
      // Offered in the tray, never rolled by itself.
      expect(posted).toHaveLength(1)
      rerender(pane({ shown: true, rollsToTable: kinds, onPending }))
      expect(posted).toHaveLength(1)
      await user.click(screen.getByRole('button', { name: 'Roll damage' }))
      expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
      await waitFor(() => expect(onPending).toHaveBeenLastCalledWith(false))
    })
  })

  // As a gone companion's pane renders it: locked, with nothing made in the game.
  describe('locked', () => {
    it('offers, never rolls, the damage of a use made before it locked', async () => {
      mockReady = true
      const user = userEvent.setup()
      const answers: Record<string, Record<string, unknown>> = {}
      const posted = answering(answers)
      const { rerender } = render(
        pane({ rollsToTable: ['use', 'damage', 'ability'] }),
      )
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      await user.click(
        screen.getByRole('button', {
          name: 'Battle Cry, DEX saving throw DC 13',
        }),
      )
      expect(posted[0]).toMatchObject({ kind: 'use', item: 'cry' })
      rerender(pane({ locked: true }))
      // Its use, followed still, comes back with its damage.
      answers['req-1'] = {
        status: 'done',
        visible: true,
        rolls: [],
        use: { type: 'save' },
        damage: {
          critical: false,
          plannable: true,
          rolls: [
            {
              formula: '1d6',
              type: 'thunder',
              dice: [{ faces: 6, number: 1 }],
            },
          ],
        },
      }
      const roll = await screen.findByRole(
        'button',
        { name: 'Roll damage' },
        { timeout: 3000 },
      )
      expect(roll).toBeDisabled()
      await user.click(roll)
      expect(mockThrows).not.toHaveBeenCalled()
      expect(screen.getByRole('status')).not.toHaveTextContent(
        'Battle Cry damage',
      )
      expect(posted).toHaveLength(1)
    })

    it('closes a target picker open as it locks, rolling nothing from it', async () => {
      mockReady = true
      const user = userEvent.setup()
      const posted = answering({})
      const fight: TableCombat = {
        id: 'cmbt1',
        name: null,
        started: true,
        round: 1,
        combatants: [
          {
            id: 'c-goblin',
            name: 'Goblin',
            initiative: 15,
            defeated: false,
            side: 'other',
          },
          {
            id: 'c-brakka',
            name: 'Brakka',
            initiative: 12,
            defeated: false,
            side: 'me',
          },
        ],
      }
      const sheet = wolf({
        actions: [{ id: 'action', label: 'Actions', actions: [biteAction()] }],
      })
      const { rerender } = render(
        pane({ sheet, combat: fight, rollsToTable: ['attack', 'damage'] }),
      )
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      await user.click(screen.getByRole('button', { name: 'Bite attack, +4' }))
      expect(
        within(screen.getByRole('dialog', { name: 'Bite attack' })).getByRole(
          'button',
          { name: 'Goblin' },
        ),
      ).toBeEnabled()
      rerender(pane({ sheet, combat: fight, locked: true }))
      expect(screen.queryByRole('dialog', { name: 'Bite attack' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Goblin' })).toBeNull()
      expect(mockThrows).not.toHaveBeenCalled()
      expect(posted).toHaveLength(0)
      expect(screen.getByRole('status')).not.toHaveTextContent('Bite attack')
    })
  })

  describe('shown again', () => {
    it('pops none of the rolls it kept', async () => {
      clearStorage('on')
      const user = userEvent.setup()
      const { rerender } = render(pane())
      for (const name of [
        'Strength check, +4',
        'Dexterity check, +1',
        'Wisdom check, +1',
      ]) {
        await user.click(screen.getByRole('button', { name }))
      }
      const log = screen.getByRole('log', { name: 'Roll results' })
      expect(within(log).getAllByText(/check$/)).toHaveLength(3)
      rerender(pane({ shown: false }))
      expect(screen.queryByRole('log', { name: 'Roll results' })).toBeNull()
      rerender(pane({ shown: true }))
      const again = screen.queryByRole('log', { name: 'Roll results' })
      expect(again ? within(again).queryAllByText(/check$/) : []).toHaveLength(
        0,
      )
    })

    it('pops nothing for a roll answered while it was hidden, and says while it was on its way', async () => {
      clearStorage('on')
      const user = userEvent.setup()
      const answers: Record<string, Record<string, unknown>> = {}
      answering(answers)
      const onBusy = jest.fn()
      const { rerender } = render(pane({ rollsToTable: ['ability'], onBusy }))
      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(true))
      rerender(pane({ rollsToTable: ['ability'], onBusy, shown: false }))
      answers['req-1'] = { status: 'done', visible: true, total: 12 }
      await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(false), {
        timeout: 3000,
      })
      rerender(pane({ rollsToTable: ['ability'], onBusy, shown: true }))
      const again = screen.queryByRole('log', { name: 'Roll results' })
      expect(again ? within(again).queryAllByText(/check$/) : []).toHaveLength(
        0,
      )
    })
  })

  it('throws its dice on the page’s renderer where it shares one, never one of its own', () => {
    render(
      <DiceRendererProvider>
        {pane({ sharedDice: true })}
        {pane({
          sharedDice: true,
          characterId: 'seat-1:c:bat',
          idPrefix: 'creature-bat-',
        })}
      </DiceRendererProvider>,
    )
    expect(mockRenderers).toHaveBeenCalledTimes(1)
  })

  it('has a renderer of its own where it shares none', () => {
    render(
      <>
        {pane()}
        {pane({ characterId: 'seat-1:c:bat', idPrefix: 'creature-bat-' })}
      </>,
    )
    expect(mockRenderers).toHaveBeenCalledTimes(2)
  })

  it('stays quiet as it settles, for a page that keeps it', async () => {
    const onBusy = jest.fn()
    render(pane({ onBusy }))
    await act(async () => {})
    expect(onBusy).toHaveBeenLastCalledWith(false)
  })
})
