import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchField } from './search-field'

/** The field as a list would hold it, its query kept by its owner. */
function Owned({ onSubmit }: Readonly<{ onSubmit?: () => void }>) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={event => {
        event.preventDefault()
        onSubmit?.()
      }}
    >
      <SearchField
        value={value}
        onChange={setValue}
        label='Search targets by name'
        placeholder='Search'
      />
    </form>
  )
}

const box = () =>
  screen.getByRole('searchbox', { name: 'Search targets by name' })

describe('components/search-field', () => {
  it('is a search box with 16px text, a Search key and no spell checking, never focused by itself', () => {
    render(<Owned />)
    expect(box()).toHaveAttribute('type', 'search')
    expect(box()).toHaveAttribute('enterkeyhint', 'search')
    expect(box()).toHaveAttribute('placeholder', 'Search')
    expect(box()).toHaveAttribute('autocomplete', 'off')
    expect(box()).toHaveAttribute('spellcheck', 'false')
    // 16px, as iOS zooms into anything smaller it focuses, at any width.
    expect(box()).toHaveClass('text-base')
    expect(box().className).not.toMatch(/text-sm|text-xs/)
    expect(box()).not.toHaveFocus()
    expect(box()).not.toHaveAttribute('autofocus')
  })

  it('clears what is typed on Escape, cancelling the key, and lets an empty box’s Escape through', async () => {
    const user = userEvent.setup()
    render(<Owned />)
    await user.type(box(), 'gob')

    // A cancelled key returns false: the dialog it's in isn't asked to close.
    expect(fireEvent.keyDown(box(), { key: 'Escape' })).toBe(false)
    expect(box()).toHaveValue('')
    expect(fireEvent.keyDown(box(), { key: 'Escape' })).toBe(true)
  })

  it('leaves Escape and Enter to an IME while it composes', async () => {
    const user = userEvent.setup()
    render(<Owned />)
    await user.type(box(), 'gob')

    expect(fireEvent.keyDown(box(), { key: 'Escape', isComposing: true })).toBe(
      true,
    )
    expect(box()).toHaveValue('gob')
    box().focus()
    expect(fireEvent.keyDown(box(), { key: 'Enter', isComposing: true })).toBe(
      true,
    )
    expect(box()).toHaveFocus()
  })

  it('leaves Escape and Enter to an IME as Safari sends them, once it has stopped composing', async () => {
    const user = userEvent.setup()
    render(<Owned />)
    await user.type(box(), 'gob')

    // Safari ends the composition before the key that ends it, sent with the IME's code alone.
    fireEvent.compositionStart(box())
    fireEvent.compositionEnd(box())
    expect(
      fireEvent.keyDown(box(), {
        key: 'Escape',
        keyCode: 229,
        isComposing: false,
      }),
    ).toBe(true)
    expect(box()).toHaveValue('gob')
    box().focus()
    fireEvent.compositionStart(box())
    fireEvent.compositionEnd(box())
    expect(
      fireEvent.keyDown(box(), {
        key: 'Enter',
        keyCode: 229,
        isComposing: false,
      }),
    ).toBe(true)
    expect(box()).toHaveFocus()

    // The same keys typed after are the field's again.
    expect(fireEvent.keyDown(box(), { key: 'Enter', keyCode: 13 })).toBe(false)
    expect(box()).not.toHaveFocus()
    expect(fireEvent.keyDown(box(), { key: 'Escape', keyCode: 27 })).toBe(false)
    expect(box()).toHaveValue('')
  })

  it('only puts the keyboard away on Enter, sending nothing', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<Owned onSubmit={onSubmit} />)
    await user.type(box(), 'gob{Enter}')

    expect(box()).not.toHaveFocus()
    expect(box()).toHaveValue('gob')
    expect(onSubmit).not.toHaveBeenCalled()
    // Cancelled, so a form it's in isn't sent, as a browser sends one on Enter in its box.
    expect(fireEvent.keyDown(box(), { key: 'Enter' })).toBe(false)
  })
})
