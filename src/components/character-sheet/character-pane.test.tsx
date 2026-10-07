/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import {
  characterSheet,
  fullerSheet,
  sheetFavorites,
  TEXTS,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { CharacterSheet } from '@/types/sending-stone'
import type { TableCombat } from '@/types/table'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

const renderPane = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <CharacterPane
      characterId='char-1'
      name='Thorin Oakenshield'
      sheet={toTableSheet(sheet, GAME)}
    />,
  )

/** Thorin's sheet, with his favorites. */
const favored = (favorites = sheetFavorites()) => fullerSheet({ favorites })

/** The sheet this many pixels wide, as a browser would lay it out. */
const wide = (width: number) =>
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width)

/** Shows a tab of the sheet. */
const show = (name: string) =>
  userEvent
    .setup()
    .click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))

describe('components/character-sheet/character-pane', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            html: '<p>Regain <span class="roll">1d10 + 5</span> hit points.</p>',
          }),
        }) as Response,
    )
  })

  it('rolls from the sheet into the tray', async () => {
    const user = userEvent.setup()
    renderPane(characterSheet())

    await user.click(
      screen.getByRole('button', {
        name: 'Strength saving throw, +7, proficient',
      }),
    )

    const status = await screen.findByText('Strength saving throw')
    const total = Number(status.parentElement?.previousSibling?.textContent)
    expect(total).toBeGreaterThanOrEqual(8)
    expect(total).toBeLessThanOrEqual(27)
    expect(screen.getByRole('status')).toHaveTextContent('+7')
  })

  it("sends a roll to the Gamemaster's game, when it takes the player's rolls, and shows its total there", async () => {
    const user = userEvent.setup()
    globalThis.localStorage.clear()
    const responses: Record<string, unknown> = {
      'POST /api/characters/char-1/rolls': { id: 'req-1' },
      'GET /api/characters/char-1/rolls/req-1': {
        id: 'req-1',
        status: 'done',
        visible: true,
        total: 31,
      },
    }
    globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const answer = responses[`${init?.method ?? 'GET'} ${url}`]
      return {
        ok: answer !== undefined,
        status: init?.method === 'POST' ? 202 : 200,
        json: async () => answer,
      } as Response
    }) as typeof fetch
    render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(characterSheet(), GAME)}
        rollsToTable={['save']}
      />,
    )

    expect(
      screen.getByRole('switch', { name: 'Send to the table' }),
    ).toBeChecked()
    await user.click(
      screen.getByRole('button', {
        name: 'Strength saving throw, +7, proficient',
      }),
    )

    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/rolls',
      expect.objectContaining({ method: 'POST' }),
    )
    const sent = JSON.parse(
      String(jest.mocked(fetch).mock.calls[0][1]?.body),
    ) as { kind: string; key: string; dice: { results: number[] }[] }
    expect(sent).toMatchObject({ kind: 'save', key: 'str', mode: 0 })
    const natural = sent.dice[0].results[0]
    expect(screen.getByRole('status')).toHaveTextContent(`d20 ${natural} +7`)
    expect(
      await screen.findByText('At the table:', {}, { timeout: 3000 }),
    ).toHaveTextContent('At the table: 31')

    // A check the game doesn't take stays here.
    await user.click(screen.getByRole('button', { name: /^Athletics check/ }))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("has Tidy 5e's tabs, and shows one part of the sheet at a time", async () => {
    const user = userEvent.setup()
    renderPane()

    const tabs = within(
      screen.getByRole('tablist', { name: 'Character sheet' }),
    )
    expect(tabs.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Character',
      'Actions',
      'Inventory',
      'Spells',
      'Features',
      'Effects, 3 conditions',
      'Biography',
    ])
    expect(tabs.getByRole('tab', { name: 'Character' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Character')
    expect(
      screen.getByText('Fighter 5 · Champion', { selector: 'span' }),
    ).toBeInTheDocument()

    await user.click(tabs.getByRole('tab', { name: 'Features' }))

    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Features')
    expect(
      screen.getByRole('heading', { name: 'Fighter Features' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Abilities' })).toBeNull()
    // Rolls are made from the Character tab, where the tray is.
    expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()
  })

  it.each([
    ['Actions', 'Bonus Actions'],
    ['Inventory', 'Weapons'],
    ['Spells', 'Spellcasting'],
    ['Effects', 'Conditions'],
    ['Biography', 'Details'],
  ])('shows %s', async (name, heading) => {
    const user = userEvent.setup()
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
    renderPane()

    await user.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))

    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(
      new RegExp(`^${name}`),
    )
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('labels only the chosen tab where all the labels might not fit, naming each for screen readers', async () => {
    const user = userEvent.setup()
    renderPane()

    const label = (name: string) =>
      screen.getByRole('tab', { name: new RegExp(`^${name}`) })
        .firstElementChild?.nextElementSibling
    expect(label('Character')).not.toHaveClass('sr-only')
    expect(label('Inventory')).toHaveClass('sr-only', '@3xl:not-sr-only')
    expect(screen.getByRole('tab', { name: 'Inventory' })).toHaveAttribute(
      'title',
      'Inventory',
    )

    await user.click(screen.getByRole('tab', { name: 'Inventory' }))

    expect(label('Inventory')).not.toHaveClass('sr-only')
    expect(label('Character')).toHaveClass('sr-only')
  })

  it("has no Spells tab for a character who doesn't cast", () => {
    renderPane(characterSheet())

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Character',
      'Actions',
      'Inventory',
      'Features',
      'Effects',
      'Biography',
    ])
  })

  it('has a Spells tab for a character with spells but no spellcasting class', () => {
    const sheet = fullerSheet()
    renderPane({ ...sheet, spellcasting: null })

    expect(screen.getByRole('tab', { name: 'Spells' })).toBeInTheDocument()
  })

  it('shows the character when the tab shown is gone', async () => {
    const user = userEvent.setup()
    const sheet = fullerSheet()
    const { rerender } = renderPane(sheet)
    await user.click(screen.getByRole('tab', { name: 'Spells' }))

    rerender(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet({ ...sheet, spellcasting: null, spells: [] }, GAME)}
      />,
    )

    expect(screen.queryByRole('tab', { name: 'Spells' })).toBeNull()
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Character')
  })

  it('rolls attacks and damage from Actions into the tray, which shows there too', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('tab', { name: 'Actions' }))

    await user.click(
      screen.getByRole('button', { name: 'Warhammer attack, +7' }),
    )
    const status = screen.getByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('Warhammer attack'))
    expect(status).toHaveTextContent(/d20 \d+ \+7/)

    await user.click(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    )
    await waitFor(() => expect(status).toHaveTextContent('Warhammer damage'))
    expect(status).toHaveTextContent(/1d8 \(\d\) \+4 Bludgeoning/)
  })

  describe('attacks at the table', () => {
    const fight: TableCombat = {
      id: 'cmbt1',
      name: null,
      started: true,
      round: 1,
      combatants: [
        {
          id: 'goblin1',
          name: 'Goblin',
          initiative: 15,
          defeated: false,
          side: 'other',
        },
        {
          id: 'thorin1',
          name: 'Thorin Oakenshield',
          initiative: 12,
          defeated: false,
          side: 'me',
        },
      ],
    }
    const preview = {
      critical: false,
      plannable: true,
      rolls: [
        {
          formula: '1d8 + 4',
          type: 'bludgeoning',
          dice: [{ faces: 8, number: 1 }],
        },
      ],
    }

    /** The game, which makes the attack, a hit, then its damage. */
    const game = () => {
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
        const answer =
          url === '/api/characters/char-1/rolls/req-1'
            ? {
                id: 'req-1',
                status: 'done',
                visible: true,
                total: 19,
                attack: { critical: false, fumble: false, outcome: 'hit' },
                damage: preview,
              }
            : { id: 'req-2', status: 'done', visible: true, total: 9 }
        return { ok: true, status: 200, json: async () => answer } as Response
      }) as typeof fetch
      return posted
    }

    const renderFight = (combat: TableCombat | null = fight) =>
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(fullerSheet(), GAME)}
          combat={combat ?? undefined}
          rollsToTable={['attack', 'damage']}
        />,
      )

    beforeEach(() => {
      globalThis.localStorage.clear()
    })

    it('makes an attack at the combatant picked, then rolls its damage there', async () => {
      const user = userEvent.setup()
      const posted = game()
      renderFight()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )
      const picker = screen.getByRole('dialog', { name: 'Warhammer attack' })
      // Nothing is rolled until a target is picked.
      expect(fetch).not.toHaveBeenCalled()
      expect(within(picker).queryByText('Thorin Oakenshield')).toBeNull()
      await user.click(within(picker).getByRole('button', { name: 'Goblin' }))

      expect(posted[0]).toMatchObject({
        kind: 'attack',
        item: 'warhammer',
        activity: 'warhammerAttack',
        target: { combatId: 'cmbt1', combatantId: 'goblin1' },
      })
      const status = screen.getByRole('status')
      await waitFor(
        () => expect(status).toHaveTextContent('At the table: 19 · Hit'),
        { timeout: 3000 },
      )

      await user.click(screen.getByRole('button', { name: 'Roll damage' }))
      expect(posted[1]).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        dice: [{ faces: 8, results: [expect.any(Number)] }],
      })
      await waitFor(() => expect(status).toHaveTextContent('Warhammer damage'))
      const [die] = (posted[1].dice as { results: number[] }[])[0].results
      expect(status).toHaveTextContent(`1d8 (${die}) +4 bludgeoning`)
      await waitFor(() => expect(status).toHaveTextContent('At the table: 9'), {
        timeout: 3000,
      })
      // Its damage is rolled once.
      expect(screen.queryByRole('button', { name: 'Roll damage' })).toBeNull()
    })

    it("rolls a waiting attack's damage from its damage chip, as the game said", async () => {
      const user = userEvent.setup()
      const posted = game()
      renderFight()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )
      await user.click(screen.getByRole('button', { name: 'No target' }))
      expect(posted[0]).toMatchObject({ kind: 'attack', target: null })
      await screen.findByText(/· Hit/, {}, { timeout: 3000 })

      await user.click(
        screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
      )

      expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
    })

    it('makes an attack at once, at no one, out of combat', async () => {
      const user = userEvent.setup()
      const posted = game()
      renderFight(null)
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted[0]).toMatchObject({ kind: 'attack', target: null })
    })

    it("asks no target for an attack the game doesn't take", async () => {
      const user = userEvent.setup()
      game()
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(fullerSheet(), GAME)}
          combat={fight}
          rollsToTable={['skill', 'save']}
        />,
      )
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )

      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Warhammer attack',
        ),
      )
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  it('keeps rolls while another part of the sheet is shown', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('button', { name: 'Strength check, +4' }))
    await screen.findByText('Strength check', { selector: 'p' })

    await user.click(screen.getByRole('tab', { name: 'Features' }))
    await user.click(screen.getByRole('tab', { name: 'Character' }))

    expect(screen.getByRole('status')).toHaveTextContent('Strength check')
  })

  it("shows the character's conditions, which open their rules in Effects", async () => {
    const user = userEvent.setup()
    renderPane()

    const conditions = within(screen.getByRole('list', { name: 'Conditions' }))
    expect(conditions.getAllByRole('button').map(b => b.textContent)).toEqual([
      'ConcentratingBless',
      'ExhaustionLevel 2',
      'Poisoned',
    ])
    await user.click(conditions.getByRole('button', { name: 'Poisoned' }))

    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/^Effects/)
    expect(
      screen.getByRole('heading', { name: 'Conditions' }),
    ).toBeInTheDocument()
  })

  it('has no conditions to show for a character without any', () => {
    renderPane(characterSheet())

    expect(screen.queryByRole('list', { name: 'Conditions' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Effects' })).toBeInTheDocument()
  })

  it('opens a feature to its description, loading it once', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('tab', { name: 'Features' }))

    const feature = screen
      .getByText('Second Wind')
      .closest('details') as HTMLElement
    expect(feature).not.toHaveAttribute('open')
    expect(fetch).not.toHaveBeenCalled()
    await user.click(within(feature).getByText('Second Wind'))

    expect(
      await within(feature).findByText('1d10 + 5', { selector: '.roll' }),
    ).toBeInTheDocument()
    expect(
      within(feature).getByText('Class Feature · Fighter 1'),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.secondWind}`,
      { signal: expect.any(AbortSignal) },
    )
  })

  describe('favorites', () => {
    afterEach(() => {
      jest.restoreAllMocks()
      localStorage.clear()
    })

    it.each(['Actions', 'Inventory', 'Spells', 'Effects'])(
      'shows them at the top of %s on a phone or tablet',
      async name => {
        renderPane(favored())
        await show(name)

        const panel = screen.getByRole('tabpanel')
        const strip = within(panel).getByRole('region', { name: 'Favorites' })
        expect(panel.querySelector('section')).toBe(strip)
        expect(within(strip).getAllByRole('listitem')).toHaveLength(7)
        expect(screen.queryByRole('complementary')).toBeNull()
      },
    )

    it.each(['Character', 'Features', 'Biography'])(
      'leaves them out of %s',
      async name => {
        globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
        renderPane(favored())
        await show(name)

        expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull()
        expect(screen.queryByRole('complementary')).toBeNull()
      },
    )

    it('shows them in a column beside those tabs where the sheet is wide enough for both', async () => {
      wide(936)
      renderPane(favored())
      await show('Actions')

      const column = screen.getByRole('complementary', { name: 'Favorites' })
      expect(within(column).getAllByRole('listitem')).toHaveLength(7)
      const panel = screen.getByRole('tabpanel')
      expect(panel).not.toContainElement(column)
      expect(
        within(panel).queryByRole('region', { name: 'Favorites' }),
      ).toBeNull()

      await show('Features')
      expect(screen.queryByRole('complementary')).toBeNull()
    })

    it('shows them at the top of the tab where the sheet is narrower', async () => {
      wide(935)
      renderPane(favored())
      await show('Spells')

      expect(screen.queryByRole('complementary')).toBeNull()
      expect(
        screen.getByRole('region', { name: 'Favorites' }),
      ).toBeInTheDocument()
    })

    it('has none to show for a sheet without any, as from a module before 0.9.0', async () => {
      wide(1200)
      renderPane()
      await show('Actions')

      expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull()
      expect(screen.queryByRole('complementary')).toBeNull()
    })

    it('rolls from them into the tray, which shows with them', async () => {
      const user = userEvent.setup()
      renderPane(favored())
      await show('Inventory')

      await user.click(
        screen.getByRole('button', {
          name: 'Perception check, +4 (proficient, passive 14)',
        }),
      )
      const status = screen.getByRole('status')
      await waitFor(() => expect(status).toHaveTextContent('Perception check'))
      expect(
        screen.getByRole('region', { name: 'Your rolls' }),
      ).toBeInTheDocument()
    })

    it("has no tray beside favorites that don't roll", async () => {
      renderPane(
        favored(
          sheetFavorites().filter(
            ({ type }) => type === 'effect' || type === 'slots',
          ),
        ),
      )
      await show('Effects')

      expect(
        screen.getByRole('region', { name: 'Favorites' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()
    })

    it('stars each one wherever the sheet lists it', async () => {
      renderPane(favored())

      expect(
        screen.getByRole('button', {
          name: 'Perception check, +4 (proficient, passive 14), favorite',
        }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', {
          name: 'Athletics check, +7 (proficient, passive 17)',
        }),
      ).toBeInTheDocument()

      await show('Actions')
      const actions = screen.getByRole('region', { name: 'Actions' })
      expect(
        within(actions).getByRole('button', {
          name: /^Warhammer\s*, favorite/,
        }),
      ).toBeInTheDocument()
      expect(
        within(actions).getByRole('button', { name: /^Handaxe Action/ }),
      ).toBeInTheDocument()

      await show('Inventory')
      const weapons = screen.getByRole('region', { name: 'Weapons' })
      expect(
        within(weapons)
          .getAllByText(', favorite')
          .map(star => star.closest('li')?.textContent?.split(',', 1)[0]),
      ).toEqual(['Warhammer'])

      await show('Effects')
      const effects = screen.getByRole('region', { name: 'Temporary Effects' })
      expect(within(effects).getByText(', favorite')).toBeInTheDocument()
    })
  })
})
