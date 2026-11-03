import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  LAYOUT_KEY,
  LAYOUTS,
  LayoutPicker,
  useActionsLayout,
} from './actions-layout'

const ids = (layouts: typeof LAYOUTS) => layouts.map(({ id }) => id)

describe('components/character-sheet/actions-layout', () => {
  afterEach(() => localStorage.clear())

  it.each([
    [0, ['list']],
    [575, ['list']],
    [576, ['list', 'table']],
    [719, ['list', 'table']],
    [720, ['list', 'columns', 'table']],
  ])('offers at %i pixels %j', (width, offered) => {
    const { result } = renderHook(() => useActionsLayout(width))

    expect(ids(result.current.offered)).toEqual(offered)
    expect(result.current.layout).toBe('list')
  })

  it('shows the layout this browser chose, and keeps a choice', () => {
    localStorage.setItem(LAYOUT_KEY, 'columns')
    const { result } = renderHook(() => useActionsLayout(800))
    expect(result.current.layout).toBe('columns')

    act(() => result.current.choose('table'))

    expect(result.current.layout).toBe('table')
    expect(localStorage.getItem('sending-stone:actions-layout')).toBe('table')
  })

  it.each([
    [390, 'table'],
    [640, 'columns'],
  ])(
    "lists the actions at %i pixels, where %s doesn't fit, keeping it chosen for a wider sheet",
    (width, chosen) => {
      localStorage.setItem(LAYOUT_KEY, chosen)
      const { result, rerender } = renderHook(useActionsLayout, {
        initialProps: width,
      })

      expect(result.current.layout).toBe('list')
      expect(localStorage.getItem(LAYOUT_KEY)).toBe(chosen)

      rerender(844)
      expect(result.current.layout).toBe(chosen)
    },
  )

  it('lists the actions for a layout this browser kept that the app no longer has', () => {
    localStorage.setItem(LAYOUT_KEY, 'grid')
    const { result } = renderHook(() => useActionsLayout(800))

    expect(result.current.layout).toBe('list')
  })

  it('picks a layout from those offered, pressed while chosen', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    render(
      <LayoutPicker
        layouts={LAYOUTS.filter(({ id }) => id !== 'columns')}
        layout='list'
        onChange={onChange}
      />,
    )

    const picker = screen.getByRole('group', { name: 'Actions layout' })
    expect(
      [...picker.querySelectorAll('button')].map(button => [
        button.textContent,
        button.getAttribute('aria-pressed'),
      ]),
    ).toEqual([
      ['List', 'true'],
      ['Table', 'false'],
    ])
    await user.click(screen.getByRole('button', { name: 'Table' }))

    expect(onChange).toHaveBeenCalledWith('table')
  })
})
