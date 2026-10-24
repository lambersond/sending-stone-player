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

    it('sits between the header and the invite link', () => {
      const note = renderNote({
        refusal: { reason: 'wrongSecret', status: 401, at, current: true },
      })

      expect(note.previousElementSibling?.tagName).toBe('HEADER')
      expect(note.nextElementSibling).toHaveTextContent(/^Invite link/)
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
      expect(link.closest('li')).toHaveClass('min-h-10')
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
})
