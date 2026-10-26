import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignCard } from './campaign-card'
import type { OwnedCampaign } from '@/types/campaign'

const campaign = (fields: Partial<OwnedCampaign> = {}): OwnedCampaign => ({
  id: 'c1',
  title: 'The Lonely Mountain',
  gameUrl: 'https://my-game.forge-vtt.com',
  worldTitle: 'Return to Erebor',
  inviteCode: 'code-1',
  connected: true,
  rosterReceived: true,
  live: true,
  rolls: {
    enabled: false,
    reaching: false,
    attacks: false,
    spells: false,
    prompts: false,
  },
  transfers: { enabled: false, reaching: false },
  characters: [],
  groups: [],
  ...fields,
})

const renderCard = (fields: Partial<OwnedCampaign> = {}) => {
  const actions = {
    changeSecret: jest.fn().mockResolvedValue({ saved: true }),
    resetInvite: jest.fn(async () => {}),
    removePlayer: jest.fn<Promise<void>, [string]>(async () => {}),
    remove: jest.fn(async () => {}),
  }
  render(
    <CampaignCard
      campaign={campaign(fields)}
      inviteUrl='https://stone.example/join/code-1'
      {...actions}
    />,
  )
  return actions
}

const noteOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-refusal]')

/** A refusal note's text, and the times in it, each shown. */
const textOf = (note: HTMLElement) => {
  const times = [...note.querySelectorAll('time')]
  for (const time of times) expect(time.textContent).not.toBe('')
  return { times, text: note.textContent }
}

/** dnd5e at this version, as a hello names it. */
const dnd5e = (version: string) => ({ id: 'dnd5e', version })

/** The card's Cookbook dishes section (module 0.38.0). */
const dishesSection = () =>
  screen.getByRole('heading', { name: 'Cookbook dishes' })
    .parentElement as HTMLElement

/** What the Cookbook dishes section says, line by line. */
const dishesTexts = () =>
  [...dishesSection().querySelectorAll('p')].map(
    ({ textContent }) => textContent,
  )

/** A dialog as a browser shows it, which jsdom's doesn't: its first control focused. */
class FocusingDialog extends HTMLDialogElement {
  override showModal() {
    this.open = true
    this.querySelector('button')?.focus()
  }
}

/** What Foundry said of itself for the players' effects (module 0.39.0). */
const effectsFoundry = (
  version: string | null,
  system?: { id: string; version: string },
): OwnedCampaign['foundry'] => ({
  receivedAt: '2026-10-28T09:00:00.000Z',
  module: { id: 'sending-stone', version },
  ...(system && { system: { ...system, title: system.id } }),
})
/** The section's lines. */
const effectsTexts = () =>
  [
    ...(
      screen.getByRole('heading', { name: "Players' effects" })
        .parentElement as HTMLElement
    ).querySelectorAll('p'),
  ].map(({ textContent }) => textContent)

describe('components/campaigns/campaign-card', () => {
  it.each([
    ['live', {}, 'Live'],
    [
      'offline',
      { live: false, lastSeenAt: '2026-10-04T19:00:00.000Z' },
      'Offline',
    ],
    [
      'never connected',
      { live: false, connected: false },
      'Waiting for Foundry',
    ],
  ])('shows a campaign that is %s', (_, fields, status) => {
    renderCard(fields)

    expect(screen.getByText(status)).toBeInTheDocument()
  })

  it('says when the last word from Foundry was', () => {
    renderCard({ live: false, lastSeenAt: '2026-10-04T19:00:00.000Z' })

    expect(screen.getByText(/Last heard/)).toBeInTheDocument()
  })

  it("explains that the campaign's characters arrive from Foundry", () => {
    renderCard({ connected: false, rosterReceived: false, live: false })

    expect(
      screen.getByText(/Reloading the game in Foundry sends them at once/),
    ).toBeInTheDocument()
  })

  it('says when Foundry sent the campaign no characters', () => {
    renderCard()

    expect(
      screen.getByText(
        /Add them on the campaign’s Players tab in Sending Stone’s settings in Foundry/,
      ),
    ).toBeInTheDocument()
  })

  describe("why Foundry's latest post was refused", () => {
    const at = '2026-10-13T11:59:00.000Z'
    const renderNote = (fields: Partial<OwnedCampaign>) => {
      const { container } = render(
        <CampaignCard
          campaign={campaign(fields)}
          inviteUrl='https://stone.example/join/code-1'
          changeSecret={jest.fn()}
          resetInvite={jest.fn()}
          removePlayer={jest.fn()}
          remove={jest.fn()}
        />,
      )
      const note = noteOf(container)
      expect(note).not.toBeNull()
      return note as HTMLElement
    }

    it.each([
      [
        'wrongSecret',
        {},
        (time: string) =>
          `At ${time}, Sending Stone refused Foundry’s post for this campaign: the secret it came with isn’t this campaign’s. Enter this campaign’s secret on its Connection tab in Sending Stone’s settings in Foundry, in the browser you run the game from, or set a new one with Change secret below and enter that.`,
      ],
      [
        'notSetUp',
        { detail: 'Mirkwood' },
        (time: string) =>
          `At ${time}, Foundry sent a campaign titled “Mirkwood” from this game, and no campaign here has that title. If it’s this one, rename it to “The Lonely Mountain” on its Connection tab in Sending Stone’s settings in Foundry.`,
      ],
      [
        'malformed',
        {
          detail:
            'chat.message.created: ✖ Invalid input: expected string\n  → at message.timestamp',
        },
        (time: string) =>
          `At ${time}, Sending Stone couldn’t read what Foundry sent and dropped it: chat.message.created: ✖ Invalid input: expected string\n  → at message.timestamp. Update the Sending Stone module; if it happens again, report it.`,
      ],
    ] as const)(
      'explains %s, boxed while current',
      (reason, fields, expected) => {
        const note = renderNote({
          live: false,
          connected: reason === 'wrongSecret',
          // Last reached before it was refused, as a campaign that worked until its secret changed.
          lastSeenAt: '2026-10-13T11:00:00.000Z',
          refusal: { reason, status: 400, at, current: true, ...fields },
        })

        const { times, text } = textOf(note)
        expect(times).toHaveLength(1)
        expect(times[0]).toHaveAttribute('dateTime', at)
        expect(text).toBe(expected(times[0].textContent ?? ''))
        expect(text).not.toContain('has reached the app since')
        expect(note).toHaveAttribute('data-refusal', reason)
        expect(note).toHaveClass(
          'rounded-lg',
          'border',
          'border-danger/40',
          'bg-danger/5',
          'p-3',
          'text-sm',
        )
        expect(note).not.toHaveClass('text-text-secondary')
      },
    )

    // Changed on purpose (round 0.39.0 §4.7): the page's head, the refusal box right under it,
    // then its two columns, then its foot.
    it('sits right under the head, before the columns and the foot', () => {
      const note = renderNote({
        refusal: { reason: 'wrongSecret', status: 401, at, current: true },
      })

      expect(note.previousElementSibling?.tagName).toBe('HEADER')
      const columns = note.nextElementSibling as HTMLElement
      expect(columns.tagName).toBe('DIV')
      expect(
        within(columns).getByRole('heading', { name: 'Characters' }),
      ).toBeInTheDocument()
      expect(
        within(columns).getByRole('heading', { name: 'Invite link' }),
      ).toBeInTheDocument()
      expect(columns.nextElementSibling?.tagName).toBe('FOOTER')
      expect(columns.nextElementSibling?.nextElementSibling).toBeNull()
    })

    it('is muted once Foundry has reached the app since, saying when', () => {
      const lastSeenAt = '2026-10-13T12:05:00.000Z'
      const note = renderNote({
        live: true,
        lastSeenAt,
        refusal: { reason: 'wrongSecret', status: 401, at, current: false },
      })

      const { times, text } = textOf(note)
      expect(times.map(time => time.getAttribute('dateTime'))).toEqual([
        at,
        lastSeenAt,
      ])
      expect(text).toBe(
        `At ${times[0].textContent}, Sending Stone refused Foundry’s post for this campaign: the secret it came with isn’t this campaign’s. Enter this campaign’s secret on its Connection tab in Sending Stone’s settings in Foundry, in the browser you run the game from, or set a new one with Change secret below and enter that. Foundry has reached the app since, at ${times[1].textContent}.`,
      )
      expect(note).toHaveClass('text-sm', 'text-text-secondary')
      expect(note).not.toHaveClass('border', 'bg-danger/5')
    })

    it('shows nothing without one', () => {
      const { container } = render(
        <CampaignCard
          campaign={campaign()}
          inviteUrl='https://stone.example/join/code-1'
          changeSecret={jest.fn()}
          resetInvite={jest.fn()}
          removePlayer={jest.fn()}
          remove={jest.fn()}
        />,
      )

      expect(noteOf(container)).toBeNull()
    })
  })

  it('asks before resetting the invite link', async () => {
    const user = userEvent.setup()
    const { resetInvite } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    let dialog = screen.getByRole('dialog', { name: 'Reset the invite link?' })
    expect(dialog).toHaveTextContent(
      'The current link to The Lonely Mountain stops working',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(resetInvite).not.toHaveBeenCalled()
    expect(dialog).not.toHaveAttribute('open')

    await user.click(screen.getByRole('button', { name: 'Reset link' }))
    dialog = screen.getByRole('dialog', { name: 'Reset the invite link?' })
    await user.click(within(dialog).getByRole('button', { name: 'Reset link' }))
    expect(resetInvite).toHaveBeenCalledTimes(1)
  })

  it('asks before deleting the campaign', async () => {
    const user = userEvent.setup()
    const { remove } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Delete campaign' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Delete The Lonely Mountain?',
    })
    expect(dialog).toHaveTextContent("This can't be undone.")
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete campaign' }),
    )

    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('links each character to its sheet, claimed or not, for the Gamemaster to roll as it (#156)', () => {
    renderCard({
      characters: [
        {
          id: 'thorin',
          name: 'Thorin',
          player: 'Alice',
          characterId: 'char-1',
        },
        { id: 'balin', name: 'Balin' },
      ],
    })

    expect(
      screen.getByText('Open one to see its sheet and roll as it.'),
    ).toBeInTheDocument()
    for (const [name, id] of [
      ['Thorin', 'thorin'],
      ['Balin', 'balin'],
    ]) {
      const link = screen.getByRole('link', { name: `Open ${name}'s sheet` })
      expect(link).toHaveAttribute('href', `/campaigns/c1/characters/${id}`)
      expect(link).toHaveTextContent(name)
      expect(link).toHaveClass('truncate')
      // Changed on purpose (round 0.39.0 §4.7): 44 px, as the design's rows.
      expect(link.closest('li')).toHaveClass('min-h-11')
    }
  })

  it('lists each character’s companions under its name, numbered as a row numbers them (module 0.36.0)', () => {
    renderCard({
      characters: [
        {
          id: 'thorin',
          name: 'Thorin',
          player: 'Alice',
          characterId: 'char-1',
          companions: [
            { name: 'Brakka', kind: 'owned' },
            { name: 'Bat', kind: 'summoned', from: 'Find Familiar' },
            { name: 'Bat', kind: 'summoned', from: 'Find Familiar' },
            { name: 'Drake', kind: 'summoned', from: 'Summon Dragon' },
          ],
        },
        { id: 'balin', name: 'Balin', companions: [] },
        { id: 'vex', name: 'Vex' },
      ],
    })

    const line = screen.getByText(
      'Companions: Brakka, Bat 1 (summoned), Bat 2 (summoned), Drake (summoned)',
    )
    expect(line).toHaveClass('text-xs', 'text-text-secondary')
    const thorin = screen.getByRole('link', { name: "Open Thorin's sheet" })
    expect(line.parentElement).toContainElement(thorin)
    expect(line.parentElement).toHaveClass('flex', 'min-w-0', 'flex-col')
    expect(thorin.closest('li')).toHaveClass('py-1.5')
    // Names only, no links of their own.
    expect(within(line).queryByRole('link')).toBeNull()
    // None for a character without companions, whose row is as it was.
    expect(screen.getAllByText(/^Companions:/)).toHaveLength(1)
    const balin = screen.getByRole('link', { name: "Open Balin's sheet" })
    expect(balin.closest('li')).toHaveClass('py-1')
    expect(balin.parentElement).toBe(balin.closest('li'))
  })

  it('offers no sheet to open before the campaign has characters', () => {
    renderCard({ characters: [] })

    expect(
      screen.queryByText('Open one to see its sheet and roll as it.'),
    ).toBeNull()
    expect(screen.queryByRole('link', { name: /sheet$/ })).toBeNull()
  })

  it("removes a player's character, after asking", async () => {
    const user = userEvent.setup()
    const { removePlayer } = renderCard({
      characters: [
        {
          id: 'actor-thorin',
          name: 'Thorin',
          player: 'Alice',
          characterId: 'char-1',
        },
        { id: 'actor-vex', name: 'Vex' },
      ],
    })

    expect(
      screen.queryByRole('button', { name: /Remove .* as Vex/ }),
    ).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Remove Alice as Thorin' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Remove Alice as Thorin?',
    })
    expect(dialog).toHaveTextContent(
      'Alice stops following The Lonely Mountain as Thorin',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(removePlayer).toHaveBeenCalledWith('char-1')
  })

  it('changes the secret', async () => {
    const user = userEvent.setup()
    const { changeSecret } = renderCard()

    await user.click(screen.getByText('Change secret'))
    await user.type(screen.getByLabelText('New secret'), 'new-secret-123')
    await user.click(screen.getByRole('button', { name: 'Save secret' }))

    expect(changeSecret).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Saved. Enter the same secret on this campaign’s Connection tab in Sending Stone’s settings in Foundry.',
    )
  })

  it('shows why a secret was refused', async () => {
    const user = userEvent.setup()
    const { changeSecret } = renderCard()
    changeSecret.mockResolvedValue({
      error: 'Use a secret of at least 12 characters.',
    })

    await user.click(screen.getByText('Change secret'))
    await user.type(screen.getByLabelText('New secret'), 'new-secret-123')
    await user.click(screen.getByRole('button', { name: 'Save secret' }))

    const input = await screen.findByLabelText('New secret')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      'Use a secret of at least 12 characters.',
    )
  })

  it.each([
    [
      'made in the game, with their attacks and spells',
      {
        enabled: true,
        reaching: true,
        attacks: true,
        spells: true,
        prompts: false,
      },
      'Checks, saves, initiative, death saves, attacks and spells your players roll and cast here are made in your game too, with the same dice. Their attacks, spells and features spend ammunition, uses and spell slots there.',
    ],
    [
      'made in the game, with their attacks, by a module before spells',
      {
        enabled: true,
        reaching: true,
        attacks: true,
        spells: false,
        prompts: false,
      },
      'Checks, saves, initiative, death saves and attacks your players roll here are made in your game too, with the same dice. Their attacks spend ammunition, uses and spell slots there.',
    ],
    [
      'made in the game, but not their attacks',
      {
        enabled: true,
        reaching: true,
        attacks: false,
        spells: false,
        prompts: false,
      },
      'Checks, saves, initiative and death saves your players roll here are made in your game too, with the same dice. Their attacks and spells stay here: to have them made in your game too, tick Attacks, spells and features on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
    ],
    [
      'made in the game, and asked for the saves it asks of them',
      {
        enabled: true,
        reaching: true,
        attacks: false,
        spells: false,
        prompts: true,
      },
      'Checks, saves, initiative and death saves your players roll here are made in your game too, with the same dice. Their attacks and spells stay here: to have them made in your game too, tick Attacks, spells and features on the campaign’s Player actions tab in Sending Stone’s settings in Foundry. When your game asks one of their characters for a saving throw, such as a concentration check, its player is asked here to roll it.',
    ],
    [
      'turned on, while the game is closed',
      {
        enabled: true,
        reaching: false,
        attacks: true,
        spells: true,
        prompts: true,
      },
      'Turned on in Foundry. Players’ rolls reach your game while it’s open; for now they stay here.',
    ],
    [
      'not turned on',
      {
        enabled: false,
        reaching: false,
        attacks: false,
        spells: false,
        prompts: false,
      },
      'They stay here. To have them made in your game with the same dice, tick Players roll in the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
    ],
  ])("says whether players' rolls are %s", (_, rolls, text) => {
    renderCard({ rolls })

    expect(screen.getByText("Players' rolls").nextSibling).toHaveTextContent(
      text,
    )
  })

  it.each([
    [
      'moved from here, at once',
      { enabled: true, reaching: true },
      'Your players take from and give to the parties they own in Foundry, and give to each other, from here. Each move is made in your game at once and posts a line in its chat.',
    ],
    [
      'turned on, the game not fetching them',
      { enabled: true, reaching: false },
      'Turned on in Foundry. Moves reach your game while it’s open.',
    ],
    [
      'off',
      { enabled: false, reaching: false },
      'Players can’t move items and coins from here. To let them, tick Players move items and coins on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
    ],
  ])(
    'says whether players move items and coins, from module 0.31.0: %s',
    (_, transfers, text) => {
      renderCard({ transfers })

      const heading = screen.getByRole('heading', { name: 'Items and coins' })
      expect(heading.nextSibling).toHaveTextContent(text)
      // After the players' rolls.
      expect(
        screen.getByText("Players' rolls").compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    },
  )

  it.each([
    ['0.30.0', 'update'],
    ['0.9.12', 'update'],
    ['0.31.0', 'tick'],
    ['0.31.2', 'tick'],
    ['1.0.0', 'tick'],
    // eslint-disable-next-line unicorn/no-null -- a hello says a version it doesn't know as null
    [null, 'tick'],
    ['dev', 'tick'],
  ] as const)(
    'says how players could move items and coins, with Sending Stone %s in Foundry: %s',
    (version, how) => {
      renderCard({
        transfers: { enabled: false, reaching: false },
        foundry: {
          receivedAt: '2026-10-20T12:00:00.000Z',
          module: { id: 'sending-stone', version },
        },
      })

      const heading = screen.getByRole('heading', { name: 'Items and coins' })
      // A module before 0.31.0 has no such setting to tick.
      expect(heading.nextSibling).toHaveTextContent(
        how === 'update'
          ? 'Players can’t move items and coins from here. Sending Stone 0.31.0 or later in Foundry lets them.'
          : 'Players can’t move items and coins from here. To let them, tick Players move items and coins on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
        { normalizeWhitespace: true },
      )
    },
  )

  it('lists its party sheets after its characters, and nothing of them without any (module 0.30.0)', () => {
    renderCard({
      groups: [
        { id: 'company', name: 'The Company', primary: true, shared: false },
      ],
    })

    const parties = screen.getByRole('heading', { name: 'Party sheets' })
    const characters = screen.getByRole('heading', { name: 'Characters' })
    expect(
      characters.compareDocumentPosition(parties) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      screen.getByRole('link', { name: "Open The Company's party sheet" }),
    ).toHaveAttribute('href', '/campaigns/c1/party/company')
  })

  it('has no party sheets section for a campaign without groups', () => {
    renderCard()

    expect(screen.queryByRole('heading', { name: 'Party sheets' })).toBeNull()
  })

  describe('dishes from the Magical Recipe Book (module 0.38.0)', () => {
    // Changed on purpose (round 0.39.0 §4.7): from module 0.39.0 the card shows to the campaign's
    // players too; before it, as the app ships first, only to Gamemasters, as v0.38 said.
    const ON =
      'On in Foundry. Players send dishes from the Magical Recipe Book, and each reaches your game as a card its players see too; you choose who ate it.'
    const ON_GM_ONLY =
      'On in Foundry. Players send dishes from the Magical Recipe Book, and each reaches you as a card only Gamemasters see.'
    const UPDATE =
      'Your Sending Stone module doesn’t take dishes yet. Version 0.38.0 or later does.'
    const SYSTEM = 'Off. Dishes need dnd5e 5.x in Foundry for now.'
    const TICK =
      'Off. To take dishes, tick Dishes from the Magical Recipe Book on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
    /** What Foundry said of itself: this module, under this system. */
    const foundry = (
      version: string | null,
      system?: { id: string; version: string },
    ): OwnedCampaign['foundry'] => ({
      receivedAt: '2026-10-25T09:00:00.000Z',
      module: { id: 'sending-stone', version },
      ...(system && { system: { ...system, title: system.id } }),
    })
    const off = { enabled: false, waiting: 0, inFoundry: 0 }

    it.each([
      [
        'on',
        {
          dishes: { ...off, enabled: true },
          foundry: foundry('0.39.0', dnd5e('5.3.3')),
        },
        ON,
      ],
      [
        'on, under a later module',
        {
          dishes: { ...off, enabled: true },
          foundry: foundry('1.2.0', dnd5e('5.3.3')),
        },
        ON,
      ],
      [
        'on, under a module that doesn’t say its version',
        {
          dishes: { ...off, enabled: true },
          // eslint-disable-next-line unicorn/no-null -- a hello says an unknown version as null
          foundry: foundry(null, dnd5e('5.3.3')),
        },
        ON,
      ],
      [
        'on, under module 0.38.1, whose cards only Gamemasters see',
        {
          dishes: { ...off, enabled: true },
          foundry: foundry('0.38.1', dnd5e('5.3.3')),
        },
        ON_GM_ONLY,
      ],
      [
        'on, under module 0.38.0',
        {
          dishes: { ...off, enabled: true },
          foundry: foundry('0.38.0', dnd5e('5.3.3')),
        },
        ON_GM_ONLY,
      ],
      [
        'module 0.37.0, which has no switch',
        { dishes: off, foundry: foundry('0.37.0', dnd5e('5.3.3')) },
        UPDATE,
      ],
      [
        'module 0.37.0 under dnd5e 6, told to update first',
        { dishes: off, foundry: foundry('0.37.0', dnd5e('6.0.5')) },
        UPDATE,
      ],
      [
        'a module before 0.37.0',
        { dishes: off, foundry: foundry('0.30.2', dnd5e('5.3.3')) },
        UPDATE,
      ],
      [
        'module 0.38.0 under dnd5e 6, its switch ticked or not',
        { dishes: off, foundry: foundry('0.38.0', dnd5e('6.0.5')) },
        SYSTEM,
      ],
      [
        'module 0.38.0 under another system',
        {
          dishes: off,
          foundry: foundry('0.38.0', { id: 'pf2e', version: '5.1.0' }),
        },
        SYSTEM,
      ],
      [
        'module 0.38.0 under dnd5e 5, its switch off',
        { dishes: off, foundry: foundry('0.38.0', dnd5e('5.3.3')) },
        TICK,
      ],
      [
        'a later module under dnd5e 5',
        { dishes: off, foundry: foundry('1.2.0', dnd5e('5.0.0')) },
        TICK,
      ],
      [
        'a module that doesn’t say its version',
        // eslint-disable-next-line unicorn/no-null -- a hello says an unknown version as null
        { dishes: off, foundry: foundry(null, dnd5e('5.3.3')) },
        TICK,
      ],
      ['given nothing of dishes, nor of Foundry', {}, TICK],
    ] as const)('says whether the game takes dishes: %s', (_, fields, text) => {
      renderCard(fields as Partial<OwnedCampaign>)

      expect(dishesTexts()).toEqual([text])
      // After the items and coins.
      expect(
        screen
          .getByRole('heading', { name: 'Items and coins' })
          .compareDocumentPosition(dishesSection()) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it.each([
      [
        { waiting: 1, inFoundry: 2 },
        '1 waiting for Foundry · 2 in Foundry for you',
      ],
      [
        { waiting: 0, inFoundry: 3 },
        '0 waiting for Foundry · 3 in Foundry for you',
      ],
      [
        { waiting: 4, inFoundry: 0 },
        '4 waiting for Foundry · 0 in Foundry for you',
      ],
    ])('counts the dishes waiting while any wait: %j', (counts, line) => {
      renderCard({ dishes: { enabled: true, ...counts } })

      expect(dishesTexts()).toEqual([ON, line])
    })

    it('counts nothing while none wait', () => {
      renderCard({ dishes: { enabled: true, waiting: 0, inFoundry: 0 } })

      expect(dishesTexts()).toEqual([ON])
    })

    const linked: OwnedCampaign['characters'] = [
      {
        id: 'actor-thorin',
        name: 'Thorin',
        player: 'Alice',
        characterId: 'char-1',
        cookbookLinked: true,
      },
      {
        id: 'actor-vex',
        name: 'Vex',
        player: 'Bob',
        characterId: 'char-2',
        cookbookLinked: false,
      },
    ]

    it('marks a character whose player’s cookbook is linked, and revokes its link, after asking', async () => {
      const user = userEvent.setup()
      const revokeCookbookLink = jest.fn<Promise<void>, [string]>(
        async () => {},
      )
      render(
        <CampaignCard
          campaign={campaign({ characters: linked })}
          inviteUrl='https://stone.example/join/code-1'
          changeSecret={jest.fn()}
          resetInvite={jest.fn()}
          removePlayer={jest.fn()}
          revokeCookbookLink={revokeCookbookLink}
          remove={jest.fn()}
        />,
      )

      const [thorin, vex] = screen.getAllByRole('listitem')
      expect(within(thorin).getByText('Cookbook linked')).toBeInTheDocument()
      expect(within(vex).queryByText('Cookbook linked')).toBeNull()
      expect(
        within(vex).queryByRole('button', { name: /cookbook link/ }),
      ).toBeNull()
      // The chip after the player's name, the revoke beside Remove.
      expect(
        [...(thorin.lastElementChild?.children ?? [])]
          // Each dialog, closed, beside the button that opens it.
          .filter(child => child.tagName !== 'DIALOG')
          .map(child => child.textContent || child.getAttribute('aria-label')),
      ).toEqual([
        'Alice',
        'Cookbook linked',
        'Revoke Alice’s cookbook link for Thorin',
        'Remove Alice as Thorin',
      ])
      // Its right group drops under the name where the row is too narrow for both.
      expect(thorin).toHaveClass('flex', 'flex-wrap', 'justify-between')

      await user.click(
        within(thorin).getByRole('button', {
          name: 'Revoke Alice’s cookbook link for Thorin',
        }),
      )
      const dialog = screen.getByRole('dialog', {
        name: 'Revoke Alice’s cookbook link for Thorin?',
      })
      expect(dialog).toHaveTextContent(
        'Dishes from Alice’s Magical Recipe Book stop reaching The Lonely Mountain until they make a new link code.',
      )
      const confirm = within(dialog).getByRole('button', {
        name: 'Revoke link',
      })
      expect(confirm).toHaveClass('bg-danger')
      await user.click(confirm)

      expect(revokeCookbookLink).toHaveBeenCalledWith('char-1')
      expect(revokeCookbookLink).toHaveBeenCalledTimes(1)
    })

    it('offers no revoke without a way to revoke, still marking the link', () => {
      renderCard({ characters: linked })

      expect(screen.getByText('Cookbook linked')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /cookbook link/ })).toBeNull()
      expect(
        screen.getByRole('button', { name: 'Remove Alice as Thorin' }),
      ).toBeInTheDocument()
    })

    it('keeps a linked row within the card on a phone: its right group no wider than the row, the player’s name wrapping before the chip', () => {
      renderCard({ characters: linked })

      const [thorin] = screen.getAllByRole('listitem')
      const group = thorin.lastElementChild as HTMLElement
      // Dropped under the name at 360-390 px, it shrinks with the row rather than run past it.
      expect(group).toHaveClass('min-w-0')
      expect(group).not.toHaveClass('shrink-0')
      // The player's name wraps, even within a long word; the chip keeps its words on one line.
      expect(within(group).getByText('Alice')).toHaveClass('wrap-anywhere')
      expect(within(group).getByText('Cookbook linked')).toHaveClass('shrink-0')
      // The card and its header no wider than the page's column, so the header's one-line
      // details are cut rather than everything in the card laid out wider than the phone.
      const card = screen.getByRole('article')
      expect(card).toHaveClass('min-w-0')
      expect(card.querySelector('header')).toHaveClass('min-w-0')
    })
  })

  describe('as the index shows it (round 0.39.0)', () => {
    it('is an article named by its title, a heading that takes focus and wraps, its world and host under it', () => {
      renderCard({ title: 'The Lonely Mountain and the Long Road Home' })

      const article = screen.getByRole('article', {
        name: 'The Lonely Mountain and the Long Road Home',
      })
      const title = within(article).getByRole('heading', { level: 2 })
      expect(title).toHaveAttribute('id', 'campaign-c1')
      expect(title).toHaveAttribute('tabindex', '-1')
      expect(title).toHaveClass('break-words')
      expect(title).not.toHaveClass('truncate')
      expect(title.nextElementSibling).toHaveTextContent(
        /^Return to Erebor · my-game\.forge-vtt\.com$/,
      )
      expect(title.nextElementSibling).toHaveClass('wrap-anywhere')
    })

    it('says only the host before Foundry has named its world', () => {
      renderCard({ worldTitle: undefined })

      expect(
        screen.getByRole('heading', { level: 2 }).nextElementSibling,
      ).toHaveTextContent(/^my-game\.forge-vtt\.com$/)
    })

    it('heads each part of it one level under its title', () => {
      renderCard({
        groups: [
          { id: 'company', name: 'The Company', primary: true, shared: true },
        ],
      })

      expect(
        screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent),
      ).toEqual([
        'Characters',
        'Party sheets',
        'Invite link',
        // The straight apostrophe four end-to-end suites read.
        "Players' rolls",
        'Items and coins',
        'Cookbook dishes',
        "Players' effects",
      ])
      expect(screen.queryByRole('heading', { level: 4 })).toBeNull()
    })

    it('lays its characters and party sheets in one column, the rest in the other, side by side from 900 px of the index', () => {
      renderCard({
        groups: [
          { id: 'company', name: 'The Company', primary: true, shared: true },
        ],
      })

      const [left, right] = [
        screen.getByRole('heading', { name: 'Characters' }),
        screen.getByRole('heading', { name: 'Invite link' }),
      ].map(heading => heading.parentElement?.parentElement as HTMLElement)
      expect(left).not.toBe(right)
      expect(left.parentElement).toBe(right.parentElement)
      // Divs, never sections: a section is one part, such as Cookbook dishes.
      expect(left.tagName).toBe('DIV')
      expect(right.tagName).toBe('DIV')
      expect(left.parentElement).toHaveClass(
        '@min-[900px]/index:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]',
      )
      expect(
        [...left.children].map(part => part.querySelector('h3')?.textContent),
      ).toEqual(['Characters', 'Party sheets'])
      expect(
        [...right.children].map(
          part =>
            part.querySelector('h3')?.textContent ??
            part.querySelector('summary')?.textContent,
        ),
      ).toEqual([
        'Invite link',
        "Players' rolls",
        'Items and coins',
        'Cookbook dishes',
        "Players' effects",
        'Foundry settings',
      ])
    })

    it.each([
      [
        'Refused, while a refusal is current, even with Foundry live',
        {
          live: true,
          refusal: {
            reason: 'wrongSecret',
            status: 401,
            at: '2026-10-13T11:59:00.000Z',
            current: true,
          },
        },
        'Refused',
        'refused',
      ],
      [
        'Live, past a refusal',
        {
          live: true,
          refusal: {
            reason: 'wrongSecret',
            status: 401,
            at: '2026-10-13T11:59:00.000Z',
            current: false,
          },
        },
        'Live',
        'live',
      ],
      [
        'Waiting for Foundry',
        { live: false, connected: false },
        'Waiting for Foundry',
        'waiting',
      ],
      ['Offline', { live: false }, 'Offline', 'offline'],
    ] as const)('heads it with its chip: %s', (_, fields, label, state) => {
      renderCard(fields as Partial<OwnedCampaign>)

      const header = screen.getByRole('article').querySelector('header')
      const chip = header?.querySelector('[data-state]')
      expect(chip).toHaveTextContent(label)
      expect(chip).toHaveAttribute('data-state', state)
    })

    it('words the invite link’s button, Copy, and names it as before', () => {
      renderCard()

      const button = screen.getByRole('button', { name: 'Copy invite link' })
      expect(button).toHaveTextContent(/^Copy$/)
      // Five end-to-end suites read the link from its code.
      expect(
        screen.getByRole('article').querySelector('code'),
      ).toHaveTextContent('https://stone.example/join/code-1')
    })

    it('gives each character’s sheet link an id, for focus to go to once its player is removed', () => {
      renderCard({
        characters: [
          {
            id: 'thorin',
            name: 'Thorin',
            player: 'Alice',
            characterId: 'char-1',
          },
        ],
      })

      expect(
        screen.getByRole('link', { name: "Open Thorin's sheet" }),
      ).toHaveAttribute('id', 'campaign-c1-sheet-thorin')
    })

    it('makes its buttons easy to tap: 40 px, its icon buttons 36', () => {
      renderCard({
        characters: [
          {
            id: 'thorin',
            name: 'Thorin',
            player: 'Alice',
            characterId: 'char-1',
          },
        ],
      })

      for (const name of ['Reset link', 'Delete campaign']) {
        expect(screen.getByRole('button', { name })).toHaveClass('min-h-10')
      }
      expect(screen.getByText('Change secret')).toHaveClass('min-h-10')
      expect(
        screen.getByRole('button', { name: 'Remove Alice as Thorin' }),
      ).toHaveClass('size-9')
    })

    describe('its dialogs, each opening on Cancel', () => {
      const showModal = HTMLDialogElement.prototype.showModal
      beforeAll(() => {
        HTMLDialogElement.prototype.showModal =
          FocusingDialog.prototype.showModal
      })
      afterAll(() => {
        HTMLDialogElement.prototype.showModal = showModal
      })

      it.each([
        ['Reset link', 'Reset the invite link?'],
        ['Remove Alice as Thorin', 'Remove Alice as Thorin?'],
        [
          'Revoke Alice’s cookbook link for Thorin',
          'Revoke Alice’s cookbook link for Thorin?',
        ],
        ['Delete campaign', 'Delete The Lonely Mountain?'],
      ])('%s', async (trigger, title) => {
        const user = userEvent.setup()
        render(
          <CampaignCard
            campaign={campaign({
              characters: [
                {
                  id: 'thorin',
                  name: 'Thorin',
                  player: 'Alice',
                  characterId: 'char-1',
                  cookbookLinked: true,
                },
              ],
            })}
            inviteUrl='https://stone.example/join/code-1'
            changeSecret={jest.fn()}
            resetInvite={jest.fn()}
            removePlayer={jest.fn()}
            revokeCookbookLink={jest.fn()}
            remove={jest.fn()}
          />,
        )

        await user.click(screen.getByRole('button', { name: trigger }))
        expect(
          within(screen.getByRole('dialog', { name: title })).getByRole(
            'button',
            { name: 'Cancel' },
          ),
        ).toHaveFocus()
      })
    })
  })

  describe("players' effects (module 0.39.0)", () => {
    const ON =
      'On in Foundry. Your players turn off and delete the effects their party put on their own characters from here, and turn off an item’s temporary effect such as Rage: never one from a monster or one made on the sheet, a condition or a concentration.'
    const UPDATE =
      'Your Sending Stone module doesn’t let players change their effects yet. Version 0.39.0 or later does.'
    const SYSTEM = 'Off. Players’ effects need D&D Fifth Edition in Foundry.'
    const TICK =
      'Off. To let them, tick Allow Players to disable & remove their own active effects on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
    it.each([
      [
        'on',
        {
          effects: { enabled: true },
          foundry: effectsFoundry('0.39.0', dnd5e('5.3.3')),
        },
        ON,
      ],
      [
        'on under dnd5e 6',
        {
          effects: { enabled: true },
          foundry: effectsFoundry('0.39.0', dnd5e('6.0.5')),
        },
        ON,
      ],
      [
        'module 0.38.1, which has no switch',
        {
          effects: { enabled: false },
          foundry: effectsFoundry('0.38.1', dnd5e('5.3.3')),
        },
        UPDATE,
      ],
      [
        'module 0.38.1 under another system, told to update first',
        { foundry: effectsFoundry('0.38.1', { id: 'pf2e', version: '6.0.0' }) },
        UPDATE,
      ],
      [
        'module 0.39.0 under another system',
        {
          effects: { enabled: false },
          foundry: effectsFoundry('0.39.0', { id: 'pf2e', version: '6.0.0' }),
        },
        SYSTEM,
      ],
      [
        'module 0.39.0 under dnd5e 6, its switch off',
        {
          effects: { enabled: false },
          foundry: effectsFoundry('0.39.0', dnd5e('6.0.5')),
        },
        TICK,
      ],
      [
        'module 0.39.0 under dnd5e 5, its switch off',
        {
          effects: { enabled: false },
          foundry: effectsFoundry('0.39.0', dnd5e('5.3.3')),
        },
        TICK,
      ],
      [
        'a module that doesn’t say its version',
        // eslint-disable-next-line unicorn/no-null -- a hello says an unknown version as null
        { foundry: effectsFoundry(null, dnd5e('5.3.3')) },
        TICK,
      ],
      ['given nothing of effects, nor of Foundry', {}, TICK],
    ] as const)(
      'says whether players change their effects: %s',
      (_, fields, text) => {
        renderCard(fields as Partial<OwnedCampaign>)

        expect(effectsTexts()).toEqual([text])
        // After the Cookbook dishes, before the Foundry settings.
        const section = screen.getByRole('heading', {
          name: "Players' effects",
        }).parentElement as HTMLElement
        expect(section.previousElementSibling).toBe(dishesSection())
        expect(section.nextElementSibling?.tagName).toBe('DETAILS')
        expect(section.querySelector('svg')).toHaveAttribute(
          'aria-hidden',
          'true',
        )
      },
    )
  })
})
