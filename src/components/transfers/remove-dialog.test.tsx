/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RemoveDialog, type RemoveDialogProps } from './remove-dialog'
import { TableApiContext } from '@/hooks/use-table-api'
import { sheetContainer, sheetItem } from '@/mocks/sending-stone'

const potions = sheetItem({
  id: 'potionThorin',
  name: 'Potion of Healing',
  type: 'consumable',
  quantity: 3,
})
const rope = sheetItem({ id: 'ropeThorin01', name: 'Rope' })
const backpack = sheetContainer({
  id: 'backpackThor',
  name: 'Backpack',
  contents: [sheetItem({ id: 'bedrollThorn', name: 'Bedroll' })],
})

const dialogProps = (
  props: Partial<RemoveDialogProps> = {},
): RemoveDialogProps => ({
  open: true,
  onClose: jest.fn(),
  mover: 'You',
  item: rope,
  character: 'Thorin',
  onRemove: jest.fn(),
  ...props,
})
const inSeat = (role: 'player' | 'gm', props: RemoveDialogProps) => (
  <TableApiContext value={{ role, api: '/api/x', key: 'x' }}>
    <RemoveDialog {...props} />
  </TableApiContext>
)
const renderDialog = (
  props: Partial<RemoveDialogProps> = {},
  role: 'player' | 'gm' = 'player',
) => {
  const all = dialogProps(props)
  const result = render(inSeat(role, all))
  return {
    ...all,
    ...result,
    rerenderWith: (next: Partial<RemoveDialogProps>) =>
      result.rerender(inSeat(role, { ...all, ...next })),
  }
}

const dialogOf = (name: string) => screen.getByRole('dialog', { name })

describe('components/transfers/remove-dialog', () => {
  it('asks only to confirm a single item, named as the sheet names it, ending with Cancel and a danger Remove', async () => {
    const user = userEvent.setup()
    const { onRemove, onClose } = renderDialog()
    const dialog = dialogOf('Remove Rope?')

    expect(within(dialog).queryByRole('group', { name: 'How many' })).toBeNull()
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).getByText('You remove 1 Rope.')).toBeVisible()
    expect(
      within(dialog).getByText('Foundry’s chat will say so.'),
    ).toBeVisible()
    expect(
      within(dialog)
        .getAllByRole('button')
        .map(button => button.textContent || button.getAttribute('aria-label')),
    ).toEqual(['Close', 'Cancel', 'Remove'])
    const remove = within(dialog).getByRole('button', { name: 'Remove' })
    expect(remove).toHaveClass('bg-danger', 'text-white', 'dark:text-page')
    expect(remove).not.toHaveAttribute('aria-disabled')
    expect(within(dialog).queryByText('Everything in it goes too.')).toBeNull()

    await user.click(remove)
    expect(onRemove).toHaveBeenCalledWith({
      item: 'ropeThorin01',
      quantity: 1,
      held: 1,
      words: {
        verb: 'remove',
        things: '1 Rope',
        other: 'Thorin',
        item: 'ropeThorin01',
      },
    })
    // Closed at once, as where it stands is the tray's to tell.
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cancels without removing anything', async () => {
    const user = userEvent.setup()
    const { onRemove, onClose } = renderDialog()
    await user.click(
      within(dialogOf('Remove Rope?')).getByRole('button', { name: 'Cancel' }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('asks how many of a stack, set to all of it, and says what that removes', async () => {
    const user = userEvent.setup()
    const { onRemove } = renderDialog({ item: potions })
    const dialog = dialogOf('Remove Potion of Healing?')

    const field = within(dialog).getByRole('textbox', { name: 'How many' })
    expect(
      within(dialog).getByRole('group', { name: 'How many' }),
    ).toBeVisible()
    expect(field).toHaveValue('3')
    expect(within(dialog).getByRole('button', { name: 'All 3' })).toBeVisible()
    expect(
      within(dialog).getByText('You remove 3 Potion of Healing.'),
    ).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'One fewer' }))
    expect(field).toHaveValue('2')
    expect(
      within(dialog).getByText('You remove 2 Potion of Healing.'),
    ).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'One more' }))
    expect(field).toHaveValue('3')
    await user.click(within(dialog).getByRole('button', { name: 'One fewer' }))

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({
        item: 'potionThorin',
        quantity: 2,
        held: 3,
        words: expect.objectContaining({ things: '2 Potion of Healing' }),
      }),
    )
  })

  it('removes nothing while how many isn’t a number it may be, by a click or by Enter', async () => {
    const user = userEvent.setup()
    const { onRemove, onClose } = renderDialog({ item: potions })
    const dialog = dialogOf('Remove Potion of Healing?')
    const field = within(dialog).getByRole('textbox', { name: 'How many' })

    await user.clear(field)
    await user.type(field, '0')
    expect(within(dialog).getByText('Choose how many.')).toBeVisible()
    expect(within(dialog).queryByText('Foundry’s chat will say so.')).toBeNull()
    const remove = within(dialog).getByRole('button', { name: 'Remove' })
    expect(remove).toHaveAttribute('aria-disabled', 'true')
    expect(remove).toHaveClass('cursor-not-allowed', 'opacity-60')
    await user.click(remove)
    await user.type(field, '{Enter}')
    expect(onRemove).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    await user.clear(field)
    await user.type(field, '2{Enter}')
    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2, held: 3 }),
    )
  })

  it('says everything in a container goes too, where all of it does and it may hold anything', async () => {
    const user = userEvent.setup()
    const { unmount } = renderDialog({ item: backpack })
    expect(
      within(dialogOf('Remove Backpack?')).getByText(
        'Everything in it goes too.',
      ),
    ).toBeVisible()
    unmount()

    // Part of a stack of two keeps what they hold with the one left.
    renderDialog({ item: { ...backpack, quantity: 2 } })
    const two = dialogOf('Remove Backpack?')
    expect(within(two).getByText('Everything in it goes too.')).toBeVisible()
    await user.click(within(two).getByRole('button', { name: 'One fewer' }))
    expect(within(two).queryByText('Everything in it goes too.')).toBeNull()
  })

  it('says so of a container whose contents aren’t known, and not of an empty one', () => {
    const { unmount } = renderDialog({
      item: { ...backpack, name: 'Sealed Chest', contents: null },
    })
    expect(
      within(dialogOf('Remove Sealed Chest?')).getByText(
        'Everything in it goes too.',
      ),
    ).toBeVisible()
    unmount()

    renderDialog({ item: { ...backpack, contents: [] } })
    expect(
      within(dialogOf('Remove Backpack?')).queryByText(
        'Everything in it goes too.',
      ),
    ).toBeNull()
  })

  it('says the Gamemaster removes it as the character, marked as theirs', async () => {
    const user = userEvent.setup()
    const { onRemove } = renderDialog({ mover: 'Thorin' }, 'gm')
    const dialog = dialogOf('Remove Rope?')
    expect(within(dialog).getByText('Thorin removes 1 Rope.')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({
        words: {
          verb: 'remove',
          things: '1 Rope',
          other: 'Thorin',
          item: 'ropeThorin01',
          mover: 'Thorin',
        },
      }),
    )
  })

  it('names an unidentified item by its sheet name alone', () => {
    renderDialog({
      item: sheetItem({
        id: 'vialThorin01',
        name: 'Strange Vial',
        identified: false,
      }),
    })
    expect(dialogOf('Remove Strange Vial?')).toBeVisible()
    expect(screen.getByText('You remove 1 Strange Vial.')).toBeVisible()
  })

  it('removes a stack of none whole, with nothing to choose', async () => {
    const user = userEvent.setup()
    const { onRemove } = renderDialog({
      item: sheetItem({ id: 'arrowsThorin', name: 'Arrows', quantity: 0 }),
    })
    const dialog = dialogOf('Remove Arrows?')
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).getByText('You remove 0 Arrows.')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ item: 'arrowsThorin', quantity: 0, held: 0 }),
    )
  })

  it('keeps how many it showed as it opened, however the sheet changes meanwhile', async () => {
    const user = userEvent.setup()
    const { onRemove, rerenderWith } = renderDialog({ item: potions })
    rerenderWith({ item: { ...potions, quantity: 5 } })
    const dialog = dialogOf('Remove Potion of Healing?')
    expect(
      within(dialog).getByRole('textbox', { name: 'How many' }),
    ).toHaveValue('3')
    expect(within(dialog).getByRole('button', { name: 'All 3' })).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(onRemove).toHaveBeenLastCalledWith(
      expect.objectContaining({ quantity: 3, held: 3 }),
    )
  })

  it('starts afresh, at all of it, each time it opens', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderDialog({ item: potions })
    await user.click(screen.getByRole('button', { name: 'One fewer' }))
    rerenderWith({ item: potions, open: false })
    rerenderWith({ item: potions, open: true })
    expect(screen.getByRole('textbox', { name: 'How many' })).toHaveValue('3')
  })
})
