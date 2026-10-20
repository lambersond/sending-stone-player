/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoveDialog, type MoveDialogProps } from './move-dialog'
import { TableApiContext } from '@/hooks/use-table-api'
import { sheetItem } from '@/mocks/sending-stone'
import type { SheetContainer, SheetCurrency } from '@/types/sending-stone'

const party = { id: 'groupIronCo01', name: 'The Iron Company', primary: true }
const thorin = { id: 'actorThorin1', name: 'Thorin' }
const vex = { id: 'actorVex0001', name: 'Vex' }

const potions = sheetItem({
  id: 'potionHeal01',
  name: 'Potion of Healing',
  type: 'consumable',
  quantity: 3,
})
const rope = sheetItem({ id: 'rope00000001', name: 'Rope' })
const coins: SheetCurrency[] = [
  { id: 'pp', label: 'Platinum', abbreviation: 'pp', value: 0 },
  { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 120 },
  { id: 'sp', label: 'Silver', abbreviation: 'sp', value: 7 },
]

const container = (
  fields: Partial<SheetContainer> & Pick<SheetContainer, 'contents'>,
): SheetContainer => ({
  ...sheetItem({ id: 'backpack0001', name: 'Backpack', type: 'container' }),
  capacity: null,
  ...fields,
})

const renderDialog = (
  props: Partial<MoveDialogProps> = {},
  role: 'player' | 'gm' = 'player',
) => {
  const onMove = jest.fn()
  const onClose = jest.fn()
  const all: MoveDialogProps = {
    open: true,
    onClose,
    mode: 'take',
    mover: 'You',
    what: { item: potions },
    from: party,
    into: thorin,
    onMove,
    ...props,
  }
  const result = render(
    <TableApiContext value={{ role, api: '/api/x', key: 'x' }}>
      <MoveDialog {...all} />
    </TableApiContext>,
  )
  return { onMove, onClose, ...result }
}

const give = (props: Partial<MoveDialogProps> = {}) => ({
  mode: 'give' as const,
  from: undefined,
  into: undefined,
  recipients: { parties: [party], characters: [vex] },
  ...props,
})

const submit = (name: string | RegExp) => screen.getByRole('button', { name })
const summary = () =>
  screen.getByText(/^(You|Thorin|Vex) |^Choose /, { selector: 'p' })

describe('components/transfers/move-dialog', () => {
  it('is titled by what moves, and for a take, by where it’s taken from', () => {
    const { unmount } = renderDialog()
    const take = screen.getByRole('dialog', { name: 'Take Potion of Healing' })
    expect(within(take).getByText('From The Iron Company')).toBeVisible()
    unmount()

    renderDialog({ what: { coins } })
    const coinsTaken = screen.getByRole('dialog', { name: 'Take coins' })
    expect(within(coinsTaken).getByText('From The Iron Company')).toBeVisible()
  })

  it('is as wide as the screen on a phone, as the side panel is', () => {
    renderDialog({ what: { coins } })
    expect(screen.getByRole('dialog', { name: 'Take coins' })).toHaveClass(
      'max-sm:w-full',
      'max-sm:max-w-none',
      'max-sm:rounded-none',
    )
  })

  it('has no subtitle for a give', () => {
    const { unmount } = renderDialog(give())
    expect(
      screen.getByRole('dialog', { name: 'Give Potion of Healing' }),
    ).toBeVisible()
    expect(screen.queryByText(/^From /)).toBeNull()
    unmount()
    renderDialog(give({ what: { coins } }))
    expect(screen.getByRole('dialog', { name: 'Give coins' })).toBeVisible()
    expect(screen.queryByText(/^From /)).toBeNull()
  })

  it('labels the move by how many: a number above one, none for one, and coins', async () => {
    const user = userEvent.setup()
    const { unmount } = renderDialog()
    // From 1, as it opens.
    expect(submit('Take')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'One more' }))
    expect(submit('Take 2')).toBeInTheDocument()
    expect(summary()).toHaveTextContent(
      'You take 2 Potion of Healing from The Iron Company.',
    )
    unmount()

    const rest = renderDialog(give({ what: { item: rope } }))
    expect(submit('Give')).toBeInTheDocument()
    rest.unmount()

    renderDialog({ what: { coins } })
    expect(submit('Take coins')).toBeInTheDocument()
  })

  it('labels a give of coins Give coins, and of some of a stack Give n', async () => {
    const user = userEvent.setup()
    const { unmount } = renderDialog(give({ what: { coins } }))
    expect(submit('Give coins')).toBeInTheDocument()
    unmount()
    renderDialog(give())
    await user.click(screen.getByRole('button', { name: 'All 3' }))
    expect(submit('Give 3')).toBeInTheDocument()
  })

  it('asks no amount of one item, or of a container that holds anything, which moves whole', () => {
    const { unmount } = renderDialog({ what: { item: rope } })
    expect(screen.queryByRole('group', { name: 'How many' })).toBeNull()
    expect(summary()).toHaveTextContent(
      'You take 1 Rope from The Iron Company.',
    )
    unmount()

    // Three backpacks, holding something: all three go.
    const full = container({
      quantity: 3,
      contents: [sheetItem({ id: 'bedroll00001', name: 'Bedroll' })],
    })
    renderDialog({ what: { item: full } })
    expect(screen.queryByRole('group', { name: 'How many' })).toBeNull()
    expect(submit('Take 3')).toBeInTheDocument()
    expect(screen.getByText('Everything in it goes too.')).toBeVisible()
  })

  it('asks no amount of a container whose contents are secret, and says nothing of them', () => {
    const secret = container({
      name: 'Locked Coffer',
      quantity: 2,
      identified: false,
      contents: null,
    })
    renderDialog({ what: { item: secret } })
    expect(screen.queryByRole('group', { name: 'How many' })).toBeNull()
    expect(screen.queryByText('Everything in it goes too.')).toBeNull()
    expect(screen.queryByText(/unequipped/)).toBeNull()
    expect(submit('Take 2')).toBeInTheDocument()
  })

  it('moves no more of a stack at once than the game does', async () => {
    const user = userEvent.setup()
    const copper = sheetItem({
      id: 'copperLoot01',
      name: 'Copper Nugget',
      type: 'loot',
      quantity: 20_000_000,
    })
    const { onMove } = renderDialog({ what: { item: copper } })
    const amount = screen.getByRole('group', { name: 'How many' })
    expect(within(amount).getByText('of 10,000,000')).toBeVisible()
    const typed = within(amount).getByRole('textbox', { name: 'How many' })
    await user.clear(typed)
    await user.type(typed, '10000001')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a whole number from 1 to 10,000,000.',
    )
    expect(summary()).toHaveTextContent('Choose how many.')

    await user.click(
      within(amount).getByRole('button', { name: 'All 10000000' }),
    )
    expect(typed).toHaveValue('10000000')
    await user.click(submit('Take 10,000,000'))
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ id: 'copperLoot01', quantity: 10_000_000 }],
      }),
    )
  })

  it('moves no container of more than the game moves at once, which moves whole, and says so', async () => {
    const user = userEvent.setup()
    const packs = container({
      quantity: 20_000_000,
      contents: [sheetItem({ id: 'bedroll00001', name: 'Bedroll' })],
    })
    // No one is chosen for it yet.
    const { onMove, onClose, unmount } = renderDialog(
      give({
        what: { item: packs },
        recipients: { parties: [], characters: [vex] },
      }),
    )
    expect(screen.queryByRole('group', { name: 'How many' })).toBeNull()
    // Said before who gets it is asked, as choosing them changes nothing.
    expect(
      screen.getByText('More than 10,000,000 can’t be moved from here.'),
    ).toBeVisible()
    expect(screen.queryByText('Foundry’s chat will say so.')).toBeNull()
    const button = submit('Give')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    expect(onMove).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    unmount()

    // As many as the game moves at once go, whole.
    const most = container({
      quantity: 10_000_000,
      contents: [sheetItem({ id: 'bedroll00001', name: 'Bedroll' })],
    })
    renderDialog(give({ what: { item: most } }))
    expect(submit('Give 10,000,000')).not.toHaveAttribute('aria-disabled')
  })

  it('splits an empty container as any stack', () => {
    renderDialog({ what: { item: container({ quantity: 2, contents: [] }) } })
    expect(screen.getByRole('group', { name: 'How many' })).toBeVisible()
    expect(screen.queryByText('Everything in it goes too.')).toBeNull()
  })

  it('says what’s equipped or attuned arrives neither, inside a container too', () => {
    const sword = sheetItem({
      id: 'longsword001',
      name: 'Longsword',
      type: 'weapon',
      equipped: true,
    })
    const { unmount } = renderDialog(give({ what: { item: sword } }))
    expect(
      screen.getByText('It arrives unequipped and unattuned.'),
    ).toBeVisible()
    unmount()

    const ring = sheetItem({ id: 'ring00000001', name: 'Ring', attuned: true })
    const pouch = container({
      id: 'pouch0000001',
      name: 'Pouch',
      contents: [ring],
    })
    const pack = container({ contents: [pouch] })
    renderDialog(give({ what: { item: pack } }))
    expect(screen.getByText('Everything in it goes too.')).toBeVisible()
    expect(
      screen.getByText('It arrives unequipped and unattuned.'),
    ).toBeVisible()
  })

  it('tells nothing of a plain item', () => {
    renderDialog({ what: { item: rope } })
    expect(screen.queryByText('Everything in it goes too.')).toBeNull()
    expect(screen.queryByText(/unequipped/)).toBeNull()
    expect(screen.getByText('Foundry’s chat will say so.')).toBeVisible()
  })

  it('says what the Gamemaster’s move does as the character does it', () => {
    const { unmount } = renderDialog({ mover: 'Thorin' }, 'gm')
    expect(summary()).toHaveTextContent(
      'Thorin takes 1 Potion of Healing from The Iron Company.',
    )
    unmount()
    renderDialog(give({ mover: 'Thorin', what: { item: rope } }), 'gm')
    expect(summary()).toHaveTextContent(
      'Thorin gives 1 Rope to The Iron Company.',
    )
  })

  it('makes no move without someone to get it, and says so', async () => {
    const user = userEvent.setup()
    const { onMove, onClose } = renderDialog(
      give({ recipients: { parties: [], characters: [vex] } }),
    )
    expect(summary()).toHaveTextContent('Choose who gets it.')
    expect(screen.queryByText('Foundry’s chat will say so.')).toBeNull()
    const button = submit('Give')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    expect(onMove).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('radio', { name: 'Vex' }))
    expect(button).not.toHaveAttribute('aria-disabled')
    expect(summary()).toHaveTextContent('You give 1 Potion of Healing to Vex.')
  })

  it('makes no move of an amount out of range, and says so', async () => {
    const user = userEvent.setup()
    const { onMove } = renderDialog()
    const amount = screen.getByRole('textbox', { name: 'How many' })
    await user.clear(amount)
    expect(summary()).toHaveTextContent('Choose how many.')
    await user.type(amount, '4')
    expect(summary()).toHaveTextContent('Choose how many.')
    const button = submit('Take')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    await user.click(button)
    // Nor by Enter in the field.
    await user.type(amount, '{Enter}')
    expect(onMove).not.toHaveBeenCalled()
  })

  it('makes no move of no coins, and says so', async () => {
    const user = userEvent.setup()
    const { onMove } = renderDialog({ what: { coins } })
    expect(summary()).toHaveTextContent('Choose how many.')
    await user.click(submit('Take coins'))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('moves some of a stack, as the chat will say it, and closes at once', async () => {
    const user = userEvent.setup()
    const { onMove, onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'One more' }))
    await user.click(submit('Take 2'))

    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove).toHaveBeenCalledWith({
      to: 'actorThorin1',
      items: [{ id: 'potionHeal01', quantity: 2 }],
      words: {
        verb: 'take',
        things: '2 Potion of Healing',
        other: 'The Iron Company',
        item: 'potionHeal01',
      },
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClose.mock.invocationCallOrder[0]).toBeGreaterThan(
      onMove.mock.invocationCallOrder[0],
    )
  })

  it('gives coins to the primary party, chosen as it opens, leaving out those with none', async () => {
    const user = userEvent.setup()
    const { onMove } = renderDialog(give({ what: { coins } }))
    expect(
      screen.getByRole('radio', { name: 'The Iron Company Primary' }),
    ).toBeChecked()
    await user.type(screen.getByRole('textbox', { name: 'Gold' }), '50')
    await user.type(screen.getByRole('textbox', { name: 'Silver' }), '0')
    expect(summary()).toHaveTextContent('You give 50 gp to The Iron Company.')
    await user.type(
      screen.getByRole('textbox', { name: 'Silver' }),
      '{Backspace}5',
    )
    await user.click(submit('Give coins'))

    expect(onMove).toHaveBeenCalledWith({
      to: 'groupIronCo01',
      currency: { gp: 50, sp: 5 },
      words: {
        verb: 'give',
        things: '50 gp and 5 sp',
        other: 'The Iron Company',
      },
    })
  })

  it('gives as the Gamemaster, naming the character who moved it', async () => {
    const user = userEvent.setup()
    const { onMove } = renderDialog(
      give({ mover: 'Thorin', what: { item: rope } }),
      'gm',
    )
    await user.click(screen.getByRole('radio', { name: 'Vex' }))
    await user.click(submit('Give'))
    expect(onMove).toHaveBeenCalledWith({
      to: 'actorVex0001',
      items: [{ id: 'rope00000001', quantity: 1 }],
      words: {
        verb: 'give',
        things: '1 Rope',
        other: 'Vex',
        item: 'rope00000001',
        mover: 'Thorin',
      },
    })
  })

  it('on the Gamemaster’s party page, takes into the character chosen, who is the one taking', async () => {
    const user = userEvent.setup()
    const { onMove } = renderDialog(
      {
        mover: '',
        into: undefined,
        receivers: [thorin, vex],
        what: { item: rope },
      },
      'gm',
    )
    const to = screen.getByRole('group', { name: 'To' })
    expect(within(to).getByText('Characters')).toBeVisible()
    expect(within(to).queryByText('Parties')).toBeNull()
    // None is chosen for them.
    for (const radio of within(to).getAllByRole('radio')) {
      expect(radio).not.toBeChecked()
    }
    expect(summary()).toHaveTextContent('Choose who gets it.')
    expect(submit('Take')).toHaveAttribute('aria-disabled', 'true')

    await user.click(screen.getByRole('radio', { name: 'Vex' }))
    expect(summary()).toHaveTextContent(
      'Vex takes 1 Rope from The Iron Company.',
    )
    await user.click(submit('Take'))
    expect(onMove).toHaveBeenCalledWith({
      to: 'actorVex0001',
      items: [{ id: 'rope00000001', quantity: 1 }],
      words: {
        verb: 'take',
        things: '1 Rope',
        other: 'The Iron Company',
        item: 'rope00000001',
        mover: 'Vex',
      },
    })
  })

  it('asks no one to get it where it’s taken into a set character', () => {
    renderDialog()
    expect(screen.queryByRole('group', { name: 'To' })).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('closes on Cancel, moving nothing', async () => {
    const user = userEvent.setup()
    const { onMove, onClose } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onMove).not.toHaveBeenCalled()
  })

  it('starts afresh each time it opens', async () => {
    const user = userEvent.setup()
    const props: MoveDialogProps = {
      open: true,
      onClose: () => {},
      mode: 'take',
      mover: 'You',
      what: { item: potions },
      from: party,
      into: thorin,
      onMove: () => {},
    }
    const { rerender } = render(<MoveDialog {...props} />)
    await user.click(screen.getByRole('button', { name: 'One more' }))
    expect(submit('Take 2')).toBeInTheDocument()
    rerender(<MoveDialog {...props} open={false} />)
    rerender(<MoveDialog {...props} />)
    expect(submit('Take')).toBeInTheDocument()
  })
})

describe('components/transfers/move-dialog, a party’s send and a give into it, from module 0.32.0', () => {
  const wardens = { id: 'groupWarden1', name: 'Wardens of the Vale' }
  const send = (props: Partial<MoveDialogProps> = {}) => ({
    mode: 'send' as const,
    from: party,
    into: undefined,
    recipients: { parties: [wardens], characters: [thorin, vex] },
    ...props,
  })

  it('is titled Send, from the party, with To listing parties then characters, none chosen', () => {
    const { unmount } = renderDialog(send({ what: { item: rope } }))
    const dialog = screen.getByRole('dialog', { name: 'Send Rope' })
    expect(within(dialog).getByText('From The Iron Company')).toBeVisible()
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map(radio => [
          radio.getAttribute('value'),
          (radio as HTMLInputElement).checked,
        ]),
    ).toEqual([
      ['groupWarden1', false],
      ['actorThorin1', false],
      ['actorVex0001', false],
    ])
    expect(summary()).toHaveTextContent('Choose who gets it.')
    expect(submit('Send')).toHaveAttribute('aria-disabled', 'true')
    unmount()

    renderDialog(send({ what: { coins } }))
    const sendingCoins = screen.getByRole('dialog', { name: 'Send coins' })
    expect(
      within(sendingCoins).getByText('From The Iron Company'),
    ).toBeVisible()
  })

  it('sends what’s chosen, saying who sends it from where to whom', async () => {
    const user = userEvent.setup()
    const { onMove, onClose } = renderDialog(send())

    await user.click(screen.getByRole('radio', { name: 'Vex' }))
    await user.clear(screen.getByRole('textbox', { name: 'How many' }))
    await user.type(screen.getByRole('textbox', { name: 'How many' }), '2')
    expect(summary()).toHaveTextContent(
      'You send 2 Potion of Healing from The Iron Company to Vex.',
    )
    expect(screen.getByText('Foundry’s chat will say so.')).toBeVisible()
    await user.click(submit('Send 2'))
    expect(onMove).toHaveBeenCalledWith({
      to: 'actorVex0001',
      items: [{ id: 'potionHeal01', quantity: 2 }],
      words: {
        verb: 'send',
        things: '2 Potion of Healing',
        other: 'Vex',
        source: 'The Iron Company',
        item: 'potionHeal01',
      },
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('says the Gamemaster’s send in the character’s name, and sends coins as Send coins', async () => {
    const user = userEvent.setup()
    const { onMove } = renderDialog(
      send({ mover: 'Thorin', what: { coins } }),
      'gm',
    )

    await user.click(screen.getByRole('radio', { name: 'Wardens of the Vale' }))
    await user.type(screen.getByRole('textbox', { name: 'Gold' }), '20')
    expect(summary()).toHaveTextContent(
      'Thorin sends 20 gp from The Iron Company to Wardens of the Vale.',
    )
    await user.click(submit('Send coins'))
    expect(onMove).toHaveBeenCalledWith({
      to: 'groupWarden1',
      currency: { gp: 20 },
      words: {
        verb: 'send',
        things: '20 gp',
        other: 'Wardens of the Vale',
        source: 'The Iron Company',
        mover: 'Thorin',
      },
    })
  })

  it('gives coins into the party with no To, from the character’s own', async () => {
    const user = userEvent.setup()
    const { onMove } = renderDialog({
      mode: 'give',
      from: undefined,
      into: party,
      what: {
        coins: [{ id: 'gp', label: 'Gold', abbreviation: 'gp', value: 65 }],
      },
    })

    const dialog = screen.getByRole('dialog', { name: 'Give coins' })
    expect(within(dialog).queryByRole('radio')).toBeNull()
    expect(within(dialog).queryByText(/^From /)).toBeNull()
    expect(within(dialog).getByText(/of 65 gp/)).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: 'Gold' }), '15')
    expect(summary()).toHaveTextContent('You give 15 gp to The Iron Company.')
    await user.click(submit('Give coins'))
    expect(onMove).toHaveBeenCalledWith({
      to: 'groupIronCo01',
      currency: { gp: 15 },
      words: { verb: 'give', things: '15 gp', other: 'The Iron Company' },
    })
  })
})
