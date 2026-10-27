/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ENDED_KEY, WildShapeEnded } from './wild-shape'
import { druidSheet, shapedSheet, wildShapeBlock } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type {
  CharacterSheet,
  WildShapeEnded as Ended,
} from '@/types/sending-stone'

const GAME = 'https://my-game.forge-vtt.com'

/** An hour, in milliseconds. */
const HOUR = 60 * 60 * 1000

/** When these pages are open: 27 October 2026, at noon. */
const NOW = Date.parse('2026-10-27T12:00:00.000Z')

/** Elowen's sheet, herself again, her Wild Shape last ended as given. */
const endedSheet = (
  ended: Partial<Ended> | null,
  fields: Partial<CharacterSheet> = {},
) =>
  toTableSheet(
    druidSheet({
      wildShape: wildShapeBlock({
        ended: ended && {
          form: 'Wolf',
          why: 'time',
          at: NOW - HOUR,
          formId: 'formWolf00000001',
          ...ended,
        },
      }),
      ...fields,
    }),
    GAME,
  )

/** The banner for Elowen's seat, with the tab's panel it gives focus to. */
const renderBanner = (sheet = endedSheet({})) => {
  const view = (shown: typeof sheet) => (
    <>
      <WildShapeEnded sheet={shown} name='Elowen' seat='char-1' />
      <div id='sheet-panel' role='tabpanel' tabIndex={-1} />
    </>
  )
  const rendered = render(view(sheet))
  return {
    ...rendered,
    rerender: (next: typeof sheet) => rendered.rerender(view(next)),
  }
}

beforeEach(() => {
  globalThis.localStorage.clear()
  jest.spyOn(Date, 'now').mockReturnValue(NOW)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('components/character-sheet/wild-shape: the banner when the game ends it, from module 0.40.0', () => {
  it.each([
    [
      'time, at 2 hours',
      { why: 'time' } as const,
      'Wild Shape ended in your game: its 2 hours ran out. Elowen is no longer a Wolf.',
    ],
    [
      '0 hit points',
      { why: 'hp' } as const,
      'Wild Shape ended in your game at 0 hit points. Elowen is no longer a Wolf.',
    ],
    [
      'Incapacitated',
      { why: 'incapacitated', form: 'Ape' } as const,
      'Wild Shape ended in your game: Elowen became Incapacitated. Elowen is no longer an Ape.',
    ],
    [
      'Foundry',
      { why: 'foundry', form: 'Black Bear' } as const,
      'Wild Shape was ended in Foundry. Elowen is no longer a Black Bear.',
    ],
  ])('says why it ended: %s', (_, ended, words) => {
    renderBanner(endedSheet(ended))

    expect(screen.getByRole('status')).toHaveTextContent(words)
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeVisible()
  })

  it('makes Dismiss a finger’s height on a phone, and at least 36 pixels from sm up, as every new control (round 0.40.0 §9.7)', () => {
    renderBanner()

    const dismiss = screen.getByRole('button', { name: 'Dismiss' })
    expect(dismiss).toHaveClass('size-11')
    // Tailwind's size-9 is 2.25rem, 36 pixels: none smaller from sm up.
    const wide = /(?:^|\s)sm:size-(\d+)(?:\s|$)/.exec(dismiss.className)
    expect(Number(wide?.[1])).toBeGreaterThanOrEqual(9)
  })

  it('says "its hour ran out" for a druid whose Wild Shape lasts an hour', () => {
    renderBanner(
      toTableSheet(
        druidSheet({
          wildShape: wildShapeBlock({
            hours: 1,
            ended: {
              form: 'Rat',
              why: 'time',
              at: NOW - HOUR,
              formId: 'formRat000000001',
            },
          }),
        }),
        GAME,
      ),
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Wild Shape ended in your game: its hour ran out. Elowen is no longer a Rat.',
    )
  })

  it('says nothing of one ended from here, nor while the sheet is a form’s, nor without an ending', () => {
    const { rerender } = renderBanner(endedSheet({ why: 'app' }))
    expect(screen.queryByRole('status')).toBeNull()

    rerender(toTableSheet(shapedSheet(), GAME))
    expect(screen.queryByRole('status')).toBeNull()

    rerender(endedSheet(null))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('is dismissed for the seat and that ending, focus to the tab’s panel, and remembered', async () => {
    const user = userEvent.setup()
    const { unmount } = renderBanner()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('tabpanel')).toHaveFocus()
    expect(globalThis.localStorage.getItem(`${ENDED_KEY}:char-1`)).toBe(
      String(NOW - HOUR),
    )
    unmount()

    // Opened again: not shown again; a newer ending is.
    const { rerender } = renderBanner()
    expect(screen.queryByRole('status')).toBeNull()
    rerender(endedSheet({ why: 'hp', at: NOW - 60_000 }))
    expect(screen.getByRole('status')).toHaveTextContent(/at 0 hit points/)
  })

  it('keeps what’s dismissed for its seat alone', () => {
    globalThis.localStorage.setItem(`${ENDED_KEY}:other-seat`, String(NOW))

    renderBanner()
    expect(screen.getByRole('status')).toBeVisible()
  })

  it('shows and dismisses it where the browser keeps nothing, as storage throws', async () => {
    const user = userEvent.setup()
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    renderBanner()

    expect(screen.getByRole('status')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows no ending 13 hours old on a page opened since, but one that changed while the page was open, however old', () => {
    const { rerender } = renderBanner(endedSheet({ at: NOW - 13 * HOUR }))
    expect(screen.queryByRole('status')).toBeNull()

    // An ending that came while this page was open, by a clock 13 hours behind.
    rerender(endedSheet({ at: NOW - 13 * HOUR + 1000, why: 'foundry' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Wild Shape was ended in Foundry.',
    )
  })

  it('shows one within the last 12 hours on a page opened since', () => {
    renderBanner(endedSheet({ at: NOW - 11 * HOUR }))

    expect(screen.getByRole('status')).toBeVisible()
  })
})
