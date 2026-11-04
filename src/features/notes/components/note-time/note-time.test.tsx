import { act, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { NoteTime } from './note-time'

describe('components/notes/note-time', () => {
  const now = new Date(2026, 9, 21, 10, 0, 0).getTime()
  const value = new Date(now - 30_000).toISOString()

  beforeEach(() => {
    jest.useFakeTimers({ now })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('says how long ago, its full date and time its title', () => {
    render(<NoteTime value={value} />)

    const time = screen.getByText('just now')
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('dateTime', value)
    expect(time.getAttribute('title')).toMatch(/2026/)
  })

  it('moves on as the minutes pass, with nothing new from the server', () => {
    render(<NoteTime value={value} />)

    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(screen.getByText('1 minute ago')).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(2 * 60_000)
    })
    expect(screen.getByText('3 minutes ago')).toBeInTheDocument()
  })

  it('says nothing on the server, which can’t know the viewer’s clock', () => {
    const html = renderToString(<NoteTime value={value} />)

    expect(html).toContain(`dateTime="${value}"`)
    expect(html).not.toContain('just now')
    expect(html).not.toContain('title=')
  })

  it('keeps one timer for every time shown, and none once they’re gone', () => {
    const { unmount } = render(
      <>
        <NoteTime value={value} />
        <NoteTime value={value} />
      </>,
    )
    expect(jest.getTimerCount()).toBe(1)
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
})
