/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import { PartyPage } from './party-page'
import { PartyPanel } from './party-panel'
import { PartySheet, PartySheetFor } from './party-sheet'
import { Concentrating } from '@/components/character-sheet/concentration'
import { ConditionsOpener } from '@/components/character-sheet/conditions-panel'
import {
  DescriptionLinks,
  type DescriptionActions,
} from '@/components/character-sheet/description-actions'
import { Enchanting } from '@/components/character-sheet/enchantments'
import { FavoriteMarks } from '@/components/character-sheet/favorite-mark'
import { Charging } from '@/components/character-sheet/uses-button'
import { forgetNotes } from '@/hooks/use-notes'
import { TableApiContext } from '@/hooks/use-table-api'
import { POLL_INTERVAL } from '@/hooks/use-table-view'
import { fakeFullscreen } from '@/mocks/fullscreen'
import {
  emptyBook,
  noteChapter,
  noteEntry,
  serveNotes,
} from '@/mocks/notes-server'
import {
  enchantment,
  GROUP_TEXTS,
  groupSheet,
  PARTY,
} from '@/mocks/sending-stone'
import { inventoryView } from '@/utils/table-view'
import type { PartyView } from '@/types/party'

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: jest.fn(),
}))

const router = { refresh: jest.fn() }

const ORIGIN = 'https://my-game.forge-vtt.com'
const API = '/api/characters/char-1/party/company'
const GM_API = '/api/campaigns/c1/party/company'

/** The Company's sheet as Thorin's player is shown it. */
const view = (fields: Partial<PartyView> = {}): PartyView => ({
  version: 7,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  group: {
    id: 'company',
    name: 'The Company',
    portrait: `${ORIGIN}/worlds/erebor/company.webp`,
    primary: true,
  },
  sheet: {
    members: [
      {
        id: PARTY.thorin,
        name: 'Thorin Oakenshield',
        portrait: `${ORIGIN}/worlds/erebor/thorin.webp`,
        own: true,
      },
      { id: PARTY.vex, name: 'Vex' },
      { id: 'myrtle', name: 'Myrtle' },
    ],
    inventory: inventoryView(groupSheet().inventory, ORIGIN),
    description: GROUP_TEXTS.description,
  },
  sheetVersion: '2026-10-19T12:00:00.000Z',
  ...fields,
})

const respond = (body: unknown, status = 200) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)

/** The server: the party's view at its API, and its descriptions under it, each by its hash. */
const serve = (party: PartyView = view()) =>
  jest.mocked(fetch).mockImplementation((async (url: string) => {
    if (url.includes('/texts/')) {
      return respond({
        html: `<p>Text ${url.slice(url.lastIndexOf('/') + 1)}</p>`,
      })
    }
    return respond(party)
  }) as typeof fetch)

const members = () =>
  within(screen.getByRole('region', { name: /^Members/ })).getAllByRole(
    'listitem',
  )

/** The names of what the stash shown holds, as listed. */
const itemNames = () =>
  within(screen.getByRole('tabpanel', { name: 'Inventory' }))
    .getAllByRole('listitem')
    .map(item => item.textContent)

describe('components/party-sheet', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn()
    serve()
    jest.mocked(useRouter).mockReturnValue(router as any)
  })

  describe('PartySheet', () => {
    it('shows its members by name and portrait only, with a plain count', () => {
      render(<PartySheet api={API} role='player' view={view()} />)

      expect(
        screen.getByRole('heading', { level: 2, name: 'Members · 3' }),
      ).toBeInTheDocument()
      expect(members().map(member => member.textContent)).toEqual([
        'Thorin Oakenshield',
        'Vex',
        'Myrtle',
      ])
      const [thorin, vex] = members()
      expect(thorin.querySelector('img')).toHaveAttribute(
        'src',
        `${ORIGIN}/worlds/erebor/thorin.webp`,
      )
      // One without a portrait has the icon in its place.
      expect(vex.querySelector('img')).toBeNull()
      expect(vex.querySelector('svg')).not.toBeNull()
      const region = screen.getByRole('region', { name: /^Members/ })
      expect(region).not.toHaveTextContent(/HP|Level|XP|Fighter|npc|character/i)
    })

    it("links the player's own character to its sheet, and no other", () => {
      render(
        <PartySheet
          api={API}
          role='player'
          view={view()}
          ownSheetHref='/characters/char-1'
        />,
      )

      const [thorin, vex, myrtle] = members()
      expect(
        within(thorin).getByRole('link', { name: 'Thorin Oakenshield' }),
      ).toHaveAttribute('href', '/characters/char-1')
      expect(within(vex).queryByRole('link')).toBeNull()
      expect(within(myrtle).queryByRole('link')).toBeNull()
    })

    it('shows its stash, a container opening to what it holds, with nothing to use, star, spend, end or roll, wherever it is', async () => {
      const user = userEvent.setup()
      // Its map enchanted, as a character could end one of their own; its description with links
      // that would roll damage and open the character's conditions panel.
      const stash = groupSheet().inventory
      const [map] = stash.sections[0].items
      stash.sections[0].items[0] = {
        ...map,
        enchantments: [enchantment({ id: 'glow', name: 'Glowing' })],
      }
      const linked = 'f8091a2b3c4d5e'
      const party = view()
      party.sheet = {
        ...party.sheet!,
        inventory: inventoryView(stash, ORIGIN),
        description: linked,
      }
      const served = jest.mocked(fetch).getMockImplementation()!
      jest.mocked(fetch).mockImplementation((async (
        url: string,
        init?: RequestInit,
      ) =>
        url.endsWith(`/texts/${linked}`)
          ? respond({
              html: '<p>Take <span class="ss-damage roll" data-n="0" data-formulas="2d6" data-types="fire">2d6</span> fire damage and fall <span class="ss-condition ref" data-condition="prone">Prone</span>.</p>',
            })
          : served(url, init)) as typeof fetch)
      const described: DescriptionActions = {
        roll: jest.fn(),
        rollDamage: jest.fn(),
        rollFormula: jest.fn(),
        takes: () => true,
        ask: jest.fn(),
        abilities: [],
        skills: [],
        tools: [],
        proficiency: null,
        conditions: [],
        showConditions: jest.fn(),
      }
      const end = jest.fn()
      // Inside a character's sheet, which gives its rows every one of these.
      render(
        <ConditionsOpener show={jest.fn()}>
          <DescriptionLinks actions={described}>
            <Enchanting actions={{ end }}>
              <Concentrating actions={{ effects: [], end: jest.fn() }}>
                <Charging actions={{ spend: jest.fn(), inspire: jest.fn() }}>
                  <FavoriteMarks keys={new Set(['item:map', 'item:wand'])}>
                    <PartySheet api={API} role='player' view={party} />
                  </FavoriteMarks>
                </Charging>
              </Concentrating>
            </Enchanting>
          </DescriptionLinks>
        </ConditionsOpener>,
      )

      const tabs = screen.getByRole('tablist', { name: 'Party sheet' })
      expect(
        within(tabs).getByRole('tab', { name: 'Inventory' }),
      ).toHaveAttribute('aria-selected', 'true')
      const panel = screen.getByRole('tabpanel', { name: 'Inventory' })
      expect(panel).toHaveTextContent('1.2k GP')
      expect(within(panel).getByText("Thror's Map")).toBeInTheDocument()

      await user.click(within(panel).getByText('Iron Chest'))
      const chest = within(panel).getByRole('list', {
        name: 'In the Iron Chest',
      })
      expect(chest).toHaveTextContent('Wand of Magic Missiles')
      // Its charges are a count, never a button that spends them.
      expect(chest).toHaveTextContent('5/7')
      // Its enchantment is named, never ended from here.
      await user.click(within(panel).getByText("Thror's Map"))
      expect(
        within(panel).getByRole('list', { name: 'Enchantments' }),
      ).toHaveTextContent('Glowing')
      expect(
        within(panel).queryByRole('button', { name: /Spend|Use|Roll|End/ }),
      ).toBeNull()
      expect(panel).not.toHaveTextContent('favorite')

      // Its description's links are only their text: nothing rolls, nor opens any panel.
      await user.click(screen.getByRole('tab', { name: 'Description' }))
      const description = screen.getByRole('tabpanel', { name: 'Description' })
      expect(
        await within(description).findByText(/^Take 2d6 fire damage/),
      ).toBeInTheDocument()
      expect(within(description).getByText('Prone')).toHaveClass('ref')
      expect(within(description).queryByRole('button')).toBeNull()
      expect(end).not.toHaveBeenCalled()
    })

    it('says so of a stash with nothing in it', () => {
      const empty = view()
      empty.sheet!.inventory = {
        ...empty.sheet!.inventory,
        sections: [],
        containers: [],
        currency: [],
      }
      render(<PartySheet api={API} role='player' view={empty} />)

      expect(screen.getByText('No items to show yet.')).toBeInTheDocument()
      expect(screen.queryByText('Currency')).toBeNull()
    })

    it('shows its description, loaded through its own API, whatever API it is placed under', async () => {
      const user = userEvent.setup()
      render(
        <TableApiContext
          value={{
            role: 'player',
            api: '/api/characters/char-1',
            key: 'char-1',
          }}
        >
          <PartySheet api={API} role='player' view={view()} />
        </TableApiContext>,
      )

      await user.click(screen.getByRole('tab', { name: 'Description' }))

      expect(
        await screen.findByText(`Text ${GROUP_TEXTS.description}`),
      ).toBeInTheDocument()
      expect(fetch).toHaveBeenCalledWith(
        `${API}/texts/${GROUP_TEXTS.description}`,
        expect.anything(),
      )
      expect(screen.getByRole('tab', { name: 'Description' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(screen.queryByRole('tabpanel', { name: 'Inventory' })).toBeNull()
    })

    it('says so of a party with no description', async () => {
      const user = userEvent.setup()
      const none = view()
      none.sheet!.description = null
      render(<PartySheet api={API} role='player' view={none} />)

      await user.click(screen.getByRole('tab', { name: 'Description' }))

      expect(screen.getByText('No description.')).toBeInTheDocument()
    })

    it.each([
      [
        'a group no player may see, to the Gamemaster',
        'gm' as const,
        { private: true as const },
        'Not shared with any player in Foundry',
        "No player in this campaign has Observer or Owner on The Company in Foundry, so its sheet isn't sent. Give them Observer or Owner on it to share it.",
      ],
      [
        'a sheet too large to send',
        'player' as const,
        {
          withheld: {
            reason: 'tooLarge' as const,
            bytes: 5_240_000,
            limit: 4_000_000,
          },
        },
        'The Company is too large to send',
        'It came to 5.3 MB, more than the 4.0 MB this app takes. Your Gamemaster has been told.',
      ],
      [
        'a sheet too large to send, its size unknown, to the Gamemaster',
        'gm' as const,
        { withheld: { reason: 'tooLarge' as const } },
        'The Company is too large to send',
        'Foundry told you so when it held it back.',
      ],
      [
        "a sheet that hasn't arrived",
        'player' as const,
        {},
        "The Company's party sheet hasn't arrived",
        "It arrives the next time your Gamemaster's game connects.",
      ],
      [
        "a sheet that hasn't arrived, to the Gamemaster",
        'gm' as const,
        {},
        "The Company's party sheet hasn't arrived",
        'It arrives the next time your game connects.',
      ],
    ])('says why there is no sheet, for %s', (_, role, fields, title, body) => {
      render(
        <PartySheet
          api={API}
          role={role}
          view={view({ sheet: undefined, sheetVersion: undefined, ...fields })}
        />,
      )

      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: title }).nextElementSibling,
      ).toHaveTextContent(body)
      expect(screen.queryByRole('tablist')).toBeNull()
    })
  })

  describe('PartySheetFor', () => {
    it.each([
      [
        'player' as const,
        "It's no longer shared with your character in Foundry.",
      ],
      ['gm' as const, "It's no longer in this campaign in Foundry."],
    ])(
      'says, to the %s, that a sheet no longer theirs to see is gone',
      (role, body) => {
        render(
          <PartySheetFor api={API} role={role} view={view()} state='gone' />,
        )

        expect(
          screen.getByRole('heading', {
            name: "This party sheet isn't available",
          }),
        ).toBeInTheDocument()
        expect(screen.getByText(body)).toBeInTheDocument()
        expect(screen.queryByText('Thorin Oakenshield')).toBeNull()
      },
    )

    it('says it is loading until the sheet first comes', () => {
      render(<PartySheetFor api={API} role='player' state='loading' />)

      expect(screen.getByRole('status')).toHaveTextContent(
        'Loading the party sheet…',
      )
    })
  })

  describe('one core in two places', () => {
    it('shows the same members and stash as its own page and in the side panel', async () => {
      const { unmount } = render(
        <PartyPage
          api={API}
          role='player'
          initialView={view()}
          back={{
            href: '/characters/char-1',
            label: 'Back to Thorin Oakenshield',
          }}
          ownSheetHref='/characters/char-1'
        />,
      )
      const onPage = {
        members: members().map(m => m.textContent),
        items: itemNames(),
      }
      unmount()

      render(
        <PartyPanel
          group={view().group}
          api={API}
          pageHref='/characters/char-1/party/company'
          role='player'
          ownSheetHref='/characters/char-1'
          onClose={jest.fn()}
        />,
      )
      await screen.findByRole('heading', { name: 'Members · 3' })

      expect({
        members: members().map(m => m.textContent),
        items: itemNames(),
      }).toEqual(onPage)
      expect(onPage.members).toEqual(['Thorin Oakenshield', 'Vex', 'Myrtle'])
      expect(fetch).toHaveBeenCalledWith(API, expect.anything())
    })

    it.each([
      ['player' as const, API, '/characters/char-1/party/company'],
      ['gm' as const, GM_API, '/campaigns/c1/party/company'],
    ])(
      'opens, for the %s, from the panel as a page',
      async (role, api, page) => {
        render(
          <PartyPanel
            group={view().group}
            api={api}
            pageHref={page}
            role={role}
            onClose={jest.fn()}
          />,
        )

        const panel = screen.getByRole('dialog', { name: 'The Company' })
        expect(panel).toHaveTextContent('Primary party')
        const link = within(panel).getByRole('link', {
          name: 'Open as page: The Company',
        })
        expect(link).toHaveAttribute('href', page)
        // Its name starts with what it shows, so it's found by the words a voice says (WCAG 2.5.3).
        expect(link).toHaveTextContent(/^Open as page$/)
        expect(link).toHaveAccessibleName(/^Open as page\b/)
        await screen.findByRole('heading', { name: 'Members · 3' })
        expect(fetch).toHaveBeenCalledWith(api, expect.anything())
      },
    )

    it('names a party that is not the primary one so', () => {
      render(
        <PartyPanel
          group={{ ...view().group, primary: false }}
          api={API}
          pageHref='/characters/char-1/party/company'
          role='player'
          onClose={jest.fn()}
        />,
      )

      expect(
        screen.getByRole('dialog', { name: 'The Company' }),
      ).toHaveTextContent(/^The CompanyParty/)
    })

    it('asks for nothing while closed', () => {
      render(
        <PartyPanel
          api={API}
          pageHref='/characters/char-1/party/company'
          role='player'
          onClose={jest.fn()}
        />,
      )

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('heads its own page with the way back, its name and campaign, whether the game is live, and full screen', () => {
      // In a browser that can fill the screen, where the real button shows.
      const fullscreen = fakeFullscreen()
      try {
        render(
          <PartyPage
            api={GM_API}
            role='gm'
            initialView={view({
              live: false,
              group: { ...view().group, primary: false },
            })}
            back={{ href: '/campaigns', label: 'Your campaigns' }}
          />,
        )

        const header = screen.getByRole('banner')
        expect(
          within(header).getByRole('link', { name: 'Your campaigns' }),
        ).toHaveAttribute('href', '/campaigns')
        expect(
          within(header).getByRole('heading', {
            level: 1,
            name: 'The Company',
          }),
        ).toHaveClass('truncate')
        expect(header).toHaveTextContent('Party · The Lonely Mountain')
        // Whether the game is live, then full screen: each by its name, or its role where it has
        // none.
        const status = within(header).getByRole('status')
        expect(
          [...status.parentElement!.children].map(
            child =>
              child.getAttribute('aria-label') ?? child.getAttribute('role'),
          ),
        ).toEqual(['status', 'Full screen'])
        expect(status.nextElementSibling).toBe(
          within(header).getByRole('button', { name: 'Full screen' }),
        )
        // The Gamemaster's game is their own.
        expect(status).toHaveTextContent('Offline')
        expect(status).toHaveTextContent("Your game hasn't been heard from")
      } finally {
        fullscreen.restore()
      }
    })

    it("says so of the primary party, on the player's page", () => {
      render(
        <PartyPage
          api={API}
          role='player'
          initialView={view()}
          back={{
            href: '/characters/char-1',
            label: 'Back to Thorin Oakenshield',
          }}
        />,
      )

      expect(screen.getByRole('banner')).toHaveTextContent(
        'Primary party · The Lonely Mountain',
      )
      expect(
        screen.getByRole('link', { name: 'Back to Thorin Oakenshield' }),
      ).toHaveAttribute('href', '/characters/char-1')
      expect(screen.getByRole('status')).toHaveTextContent('Live')
    })

    it.each([
      ['player' as const, API],
      ['gm' as const, GM_API],
    ])(
      'sends the %s, once signed out, to sign in and back, never saying the sheet was taken away in Foundry',
      async (role, api) => {
        jest.useFakeTimers()
        try {
          jest.mocked(fetch).mockImplementation(() => respond({}, 401))
          render(
            <PartyPage
              api={api}
              role={role}
              initialView={view()}
              back={{ href: '/characters/char-1', label: 'Back' }}
            />,
          )

          await act(async () => {
            await jest.advanceTimersByTimeAsync(POLL_INTERVAL * 3)
          })

          // The page is rendered again, which, signed out, goes to sign in.
          expect(router.refresh).toHaveBeenCalledTimes(1)
          expect(fetch).toHaveBeenCalledTimes(1)
          expect(
            screen.queryByRole('heading', {
              name: "This party sheet isn't available",
            }),
          ).toBeNull()
          expect(screen.queryByText(/no longer/)).toBeNull()
          expect(members()).toHaveLength(3)
        } finally {
          jest.useRealTimers()
        }
      },
    )
  })
})

/** The server: the party's book, its view, and its descriptions. */
const serveParty = (
  party: PartyView = view(),
  book = emptyBook({ kind: 'party' }),
) =>
  serveNotes({ [API]: book, [GM_API]: book }, async url => {
    if (url.includes('/texts/')) {
      return respond({
        html: `<p>Text ${url.slice(url.lastIndexOf('/') + 1)}</p>`,
      })
    }
    return respond(party)
  })
const notesRegion = () => screen.getByRole('region', { name: 'Journal' })
/** The party's journal, opened from its card. */
const openJournal = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    await within(notesRegion()).findByRole('button', {
      name: 'Open The Company’s Journal',
    }),
  )
  return screen.findByRole('dialog', { name: 'The Company’s Journal' })
}

describe('components/party-sheet, the party’s journal (module 0.35.0)', () => {
  beforeEach(() => {
    forgetNotes()
    jest.mocked(useRouter).mockReturnValue(router as any)
  })

  afterEach(() => {
    act(() => forgetNotes())
  })

  it('keeps its tabs, and opens Description on the journal’s card, then the description under its heading', async () => {
    const user = userEvent.setup()
    serveParty()
    render(
      <PartySheetFor api={API} role='player' view={view()} state='ready' />,
    )

    expect(
      within(screen.getByRole('tablist', { name: 'Party sheet' }))
        .getAllByRole('tab')
        .map(tab => tab.textContent),
    ).toEqual(['Inventory', 'Description'])
    expect(screen.queryByRole('region', { name: 'Journal' })).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Description' }))
    const panel = screen.getByRole('tabpanel', { name: 'Description' })
    const [first, second] = within(panel).getAllByRole('region')
    expect(first).toHaveAccessibleName('Journal')
    expect(
      within(first).getByRole('heading', { level: 2, name: 'Journal' }),
    ).toHaveClass('text-sm', 'font-semibold')
    expect(second).toHaveAccessibleName('Description')
    expect(
      within(second).getByRole('heading', { level: 2, name: 'Description' }),
    ).toHaveClass('text-sm', 'font-semibold')
    expect(
      await within(second).findByText(`Text ${GROUP_TEXTS.description}`),
    ).toBeInTheDocument()
    expect(
      await within(first).findByText(
        'Everyone in The Company sees these, here and in Foundry.',
      ),
    ).toBeInTheDocument()
    expect(within(first).getByText('The Company’s Journal')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`${API}/notes`, expect.anything())
  })

  it('says so, under its heading, of a party with no description', async () => {
    const user = userEvent.setup()
    serveParty()
    const none = view()
    none.sheet = { ...none.sheet!, description: null }
    render(<PartySheetFor api={API} role='player' view={none} state='ready' />)
    await user.click(screen.getByRole('tab', { name: 'Description' }))
    expect(
      within(screen.getByRole('region', { name: 'Description' })).getByText(
        'No description.',
      ),
    ).toBeInTheDocument()
  })

  it('shows no journal in the sheet alone, as before', async () => {
    const user = userEvent.setup()
    serveParty()
    render(<PartySheet api={API} role='player' view={view()} />)
    await user.click(screen.getByRole('tab', { name: 'Description' }))
    expect(screen.queryByRole('region', { name: 'Journal' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Description' })).toBeNull()
  })

  it.each([
    ["hasn't arrived", {}, "The Company's party sheet hasn't arrived"],
    [
      'is too large to send',
      { withheld: { reason: 'tooLarge' as const } },
      'The Company is too large to send',
    ],
  ])(
    'shows the journal’s card under why there’s no sheet, where it %s',
    async (_, fields, title) => {
      serveParty()
      render(
        <PartySheetFor
          api={API}
          role='player'
          view={view({ sheet: undefined, sheetVersion: undefined, ...fields })}
          state='ready'
        />,
      )
      const why = screen.getByRole('heading', { name: title })
      expect(
        why.compareDocumentPosition(notesRegion()) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(
        await within(notesRegion()).findByRole('button', {
          name: 'Open The Company’s Journal',
        }),
      ).toBeInTheDocument()
    },
  )

  it('shows a private party’s journal on the Gamemaster’s page, read only, saying why', async () => {
    const user = userEvent.setup()
    serveParty(
      view(),
      emptyBook({
        kind: 'party',
        canAdd: false,
        canReorder: false,
        withheld: { reason: 'private' },
        chapters: [noteChapter()],
        entries: [
          noteEntry({ chapterId: 'sessionChapter01' }),
          noteEntry({ id: 'wolvesNote000001', title: 'Wolves' }),
        ],
      }),
    )
    render(
      <PartySheetFor
        api={GM_API}
        role='gm'
        view={view({
          sheet: undefined,
          sheetVersion: undefined,
          private: true,
        })}
        state='ready'
      />,
    )
    expect(
      screen.getByRole('heading', {
        name: 'Not shared with any player in Foundry',
      }),
    ).toBeInTheDocument()
    const dialog = await openJournal(user)
    expect(
      await within(dialog).findByText(
        'No player can see The Company in Foundry, so its notes aren’t shared.',
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Read only')).toBeInTheDocument()
    const nobody = async () => {
      for (const name of [
        /^New note/,
        'New chapter',
        /^Rename/,
        /^Edit/,
        /^Delete/,
        /^Move/,
        'Reorder',
      ]) {
        expect(within(dialog).queryAllByRole('button', { name })).toEqual([])
      }
    }
    const contents = within(
      within(dialog).getByRole('navigation', { name: 'Contents' }),
    )
    await user.click(contents.getByRole('button', { name: 'The goblin cave' }))
    await nobody()
    await user.click(contents.getByRole('button', { name: 'Session 1' }))
    await nobody()
    await user.click(contents.getByRole('button', { name: 'Not in a chapter' }))
    await nobody()
  })

  it('opens the journal again, its draft with it, under why there’s no sheet as the sheet arrives, on Description', async () => {
    const user = userEvent.setup()
    serveParty()
    const { rerender } = render(
      <PartySheetFor
        api={API}
        role='player'
        view={view({ sheet: undefined, sheetVersion: undefined })}
        state='ready'
      />,
    )
    const dialog = await openJournal(user)
    await user.click(
      await within(dialog).findByRole('button', { name: 'New note' }),
    )
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Wolves')
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Three.')

    rerender(
      <PartySheetFor api={API} role='player' view={view()} state='ready' />,
    )

    expect(screen.getByRole('tab', { name: 'Description' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await screen.findByRole('dialog', { name: 'The Company’s Journal' })
    expect(await screen.findByRole('textbox', { name: 'Title' })).toHaveValue(
      'Wolves',
    )
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('Three.')
  })

  it('keeps the journal open, no draft in it, as the sheet arrives, on Description', async () => {
    const user = userEvent.setup()
    serveParty()
    const { rerender } = render(
      <PartySheetFor
        api={API}
        role='player'
        view={view({ sheet: undefined, sheetVersion: undefined })}
        state='ready'
      />,
    )
    await openJournal(user)

    rerender(
      <PartySheetFor api={API} role='player' view={view()} state='ready' />,
    )

    expect(screen.getByRole('tab', { name: 'Description' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      await screen.findByRole('dialog', { name: 'The Company’s Journal' }),
    ).toBeInTheDocument()
  })

  it('keeps a note half written, the journal closed, across Inventory and back, and across the panel closed and opened again', async () => {
    const user = userEvent.setup()
    serveParty()
    const panel = (open: boolean) => (
      <PartyPanel
        group={open ? view().group : undefined}
        api={API}
        pageHref='/characters/char-1/party/company'
        role='player'
        onClose={jest.fn()}
      />
    )
    const { rerender } = render(panel(true))
    await user.click(await screen.findByRole('tab', { name: 'Description' }))
    const dialog = await openJournal(user)
    await user.click(
      await within(dialog).findByRole('button', { name: 'New note' }),
    )
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Wolves')
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('tab', { name: 'Inventory' }))
    expect(screen.queryByText('Unsaved: Wolves')).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Description' }))
    expect(screen.getByText('Unsaved: Wolves')).toBeInTheDocument()

    rerender(panel(false))
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(panel(true))

    // It opens on Description, the draft waiting on the card.
    const description = await screen.findByRole('tab', { name: 'Description' })
    expect(description).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Unsaved: Wolves')).toBeInTheDocument()
    await openJournal(user)
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Wolves')
  })

  it('opens the journal over the party panel, a dialog over that dialog, and leaves the panel open as it closes', async () => {
    const user = userEvent.setup()
    serveParty()
    const onClose = jest.fn()
    render(
      <PartyPanel
        group={view().group}
        api={API}
        pageHref='/characters/char-1/party/company'
        role='player'
        onClose={onClose}
      />,
    )
    await user.click(await screen.findByRole('tab', { name: 'Description' }))
    const dialog = await openJournal(user)
    const panel = screen.getByRole('dialog', { name: 'The Company' })
    expect(panel).toContainElement(dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(
      screen.queryByRole('dialog', { name: 'The Company’s Journal' }),
    ).toBeNull()
    expect(panel).toHaveAttribute('open')
    expect(onClose).not.toHaveBeenCalled()
  })
})
