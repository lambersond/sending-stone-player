import { render } from '@testing-library/react'
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

  it('leaves the time to the browser when rendered on the server', () => {
    const html = renderToString(<LocalTime value='2026-10-04T19:02:00.000Z' />)

    expect(html).toBe('<time dateTime="2026-10-04T19:02:00.000Z"></time>')
  })
})
