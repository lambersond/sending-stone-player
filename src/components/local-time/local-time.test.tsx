import { act, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { LocalTime } from './local-time'

describe('components/game-table/local-time', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("shows only the time for today's messages", () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 4, 22, 0) })
    const { container } = render(
      <LocalTime value={new Date(2026, 9, 4, 20, 5).toISOString()} />,
    )

    expect(container.textContent).toMatch(/8:05/)
    expect(container.textContent).not.toMatch(/Oct/)
  })

  it('adds the date for older messages', () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 5, 9, 0) })
    const { container } = render(
      <LocalTime value={new Date(2026, 9, 4, 20, 5).toISOString()} />,
    )

    expect(container.textContent).toMatch(/Oct 4/)
  })

  it('adds the date once the day turns, with nothing else rendered again', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 23, 58) })
    const { container, unmount } = render(
      <LocalTime value={new Date(2026, 10, 3, 23, 55).toISOString()} />,
    )
    expect(container.textContent).not.toMatch(/Nov/)

    act(() => jest.advanceTimersByTime(3 * 60_000))

    expect(container.textContent).toMatch(/Nov 3/)
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })

  it('keeps one midnight timer for every time shown, set again after it fires', () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 3, 23, 58) })
    const value = new Date(2026, 10, 3, 23, 55).toISOString()
    const { container, unmount } = render(
      <>
        <LocalTime value={value} />
        <LocalTime value={value} />
        <LocalTime value={value} />
      </>,
    )
    expect(jest.getTimerCount()).toBe(1)

    act(() => jest.advanceTimersByTime(3 * 60_000))

    expect(container.textContent?.match(/Nov 3/g)).toHaveLength(3)
    expect(jest.getTimerCount()).toBe(1)
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })

  it('leaves the time to the browser when rendered on the server', () => {
    const html = renderToString(<LocalTime value='2026-10-04T19:02:00.000Z' />)

    expect(html).toBe('<time dateTime="2026-10-04T19:02:00.000Z"></time>')
  })
})
