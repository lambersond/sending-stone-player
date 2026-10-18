/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

// The theme's colours, measured as WCAG measures text against what's behind it: the accent as
// small text on its own tints, such as a selected option's or a badge's, over the page or a card.

const css = readFileSync(
  path.join(process.cwd(), 'src/app/globals.css'),
  'utf8',
)

/** The colour tokens one block of the stylesheet sets, by name. */
function tokens(start: string): Record<string, string> {
  const from = css.indexOf(start)
  const block = css.slice(from, css.indexOf('\n}', from))
  return Object.fromEntries(
    [...block.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6});/gi)].map(
      ([, name, value]) => [name, value.toLowerCase()],
    ),
  )
}

const light = tokens('@theme {')
const dark = { ...light, ...tokens('.dark {') }

const rgb = (hex: string) =>
  [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16))

/** A tint of a colour over a surface, as the browser draws one, such as `bg-primary/10`. */
const tint = (hex: string, alpha: number, over: string) => {
  const below = rgb(over)
  return rgb(hex).map(
    (channel, index) => channel * alpha + below[index] * (1 - alpha),
  )
}

const luminance = (channels: number[]) => {
  const [r, g, b] = channels.map(channel => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG's contrast ratio between two colours. */
const contrast = (one: number[], other: number[]) => {
  const [lighter, darker] = [luminance(one), luminance(other)].toSorted(
    (a, b) => b - a,
  )
  return (lighter + 0.05) / (darker + 0.05)
}

/** The accent's tints the app draws behind its text. */
const TINTS = [0, 0.05, 0.1, 0.12, 0.15, 0.2]

/** A tint of a colour over what's already drawn, as the browser stacks one on another. */
const stack = (hex: string, alpha: number, below: number[]) =>
  rgb(hex).map((channel, index) => channel * alpha + below[index] * (1 - alpha))

type Theme = Record<string, string>

/** The chat's bubbles, each as drawn over the page, as the chat pane puts nothing between. */
const bubbles = (theme: Theme): [string, number[]][] => [
  ['a bubble of anyone else', rgb(theme.card)],
  ["the player's own", stack(theme.primary, 0.1, rgb(theme.page))],
  ['a whisper', stack(theme.whisper, 0.05, rgb(theme.page))],
]

/**
 * The chat's small text this app draws on a tint, or on the bubble itself: by its text's token,
 * then its tint's token and how strong the tint is.
 */
const CHAT_TEXT: [string, string, string, number][] = [
  ['the Damage chip', 'damage-text', 'damage', 0.15],
  ['the Healing chip', 'primary-text', 'primary', 0.1],
  ['the Attack chip', 'attack-text', 'attack', 0.15],
  ['the Spell and Spell attack chips', 'spell-text', 'spell', 0.15],
  ['the Hit pill', 'primary-text', 'primary', 0.1],
  ['the Miss pill', 'text-secondary', 'text-secondary', 0.1],
  ["a damage chip's word", 'damage-text', 'damage', 0.1],
  ["a healing chip's word", 'primary-text', 'primary', 0.1],
  ['a "No damage" chip', 'text-secondary', 'text-secondary', 0.1],
  ["a damage chip's number", 'text-primary', 'damage', 0.1],
  ["a healing chip's number", 'text-primary', 'primary', 0.1],
  [
    'the "Other damage" caption, a formula, a save line and a tag',
    'text-secondary',
    'page',
    0,
  ],
]

/**
 * The marks of whose side a combatant is on, in the combat tracker and the target picker: by
 * their text's token, then their tint's token and how strong the tint is. Each sits on a card, or
 * a row of it tinted for whose turn it is, or ticked.
 */
const SIDE_TEXT: [string, string, string, number][] = [
  ["an ally's initiative box, and the Ally pill", 'party', 'party', 0.15],
  [
    "a neutral creature's initiative box",
    'text-secondary',
    'text-secondary',
    0.15,
  ],
  ['the Neutral pill', 'text-secondary', 'text-secondary', 0.1],
  ['the You pill', 'primary-text', 'primary', 0.1],
]

describe('app/globals.css', () => {
  it.each(['page', 'card'])(
    'reads the accent as small text at WCAG AA on each of its tints over the %s, in the light theme',
    surface => {
      for (const alpha of TINTS) {
        const behind = tint(light.primary, alpha, light[surface])
        expect(contrast(rgb(light['primary-text']), behind)).toBeGreaterThan(
          4.5,
        )
      }
    },
  )

  it('needs it there, as the accent itself falls short on its tints', () => {
    const behind = tint(light.primary, 0.1, light.page)
    expect(contrast(rgb(light.primary), behind)).toBeLessThan(4.5)
    expect(light['primary-text']).toBe(light['primary-hover'])
  })

  describe.each([
    ['light', light],
    ['dark', dark],
  ])('the chat, in the %s theme', (_, theme) => {
    it.each(CHAT_TEXT)(
      'reads %s at WCAG AA over every bubble',
      (__, text, behind, alpha) => {
        for (const [, bubble] of bubbles(theme)) {
          const ground = stack(theme[behind], alpha, bubble)
          expect(contrast(rgb(theme[text]), ground)).toBeGreaterThanOrEqual(4.5)
        }
      },
    )

    it("reads a damage card's total, large text, at WCAG AA over every bubble, a critical's in gold", () => {
      for (const [, bubble] of bubbles(theme)) {
        expect(
          contrast(rgb(theme['gold-text']), bubble),
        ).toBeGreaterThanOrEqual(3)
        expect(
          contrast(rgb(theme['text-primary']), bubble),
        ).toBeGreaterThanOrEqual(3)
      }
    })
  })

  describe.each([
    ['light', light],
    ['dark', dark],
  ])(
    'the combat tracker and the target picker, in the %s theme',
    (_, theme) => {
      it.each(SIDE_TEXT)(
        'reads %s at WCAG AA over a card, and over a row tinted on it',
        (__, text, behind, alpha) => {
          const card = rgb(theme.card)
          for (const row of [card, stack(theme.primary, 0.05, card)]) {
            const ground = stack(theme[behind], alpha, row)
            expect(contrast(rgb(theme[text]), ground)).toBeGreaterThanOrEqual(
              4.5,
            )
          }
        },
      )
    },
  )

  it("needs the chat's text tokens in the light theme, where the colours fall short on their tints", () => {
    const [, mine] = bubbles(light)[1]
    for (const name of ['damage', 'attack', 'spell']) {
      expect(
        contrast(rgb(light[name]), stack(light[name], 0.15, mine)),
      ).toBeLessThan(4.5)
    }
  })

  it('makes them the colours themselves in the dark theme', () => {
    for (const name of ['damage', 'attack', 'spell']) {
      expect(dark[`${name}-text`]).toBe(dark[name])
    }
  })

  it("would fall short with a tint under a damage card's summary on a hover, so it has none", () => {
    // As `hover:bg-primary/5` would draw it, over the player's own bubble, in the light theme.
    const [, mine] = bubbles(light)[1]
    const hovered = stack(light.primary, 0.05, mine)
    expect(
      contrast(rgb(light['primary-text']), stack(light.primary, 0.1, hovered)),
    ).toBeLessThan(4.5)
    expect(contrast(rgb(light['gold-text']), hovered)).toBeLessThan(3)
  })

  it.each([
    ['light', light],
    ['dark', dark],
  ])(
    'reads the Inspired mark, small gold text, at WCAG AA on the page and a card, and their hover tint, in the %s theme',
    (_, theme) => {
      for (const surface of ['page', 'card']) {
        for (const alpha of [0, 0.05]) {
          const behind = tint(theme.primary, alpha, theme[surface])
          expect(contrast(rgb(theme['gold-label']), behind)).toBeGreaterThan(
            4.5,
          )
        }
      }
    },
  )

  it('needs it there, as the gold for large text falls short as small text in the light theme', () => {
    expect(contrast(rgb(light['gold-text']), rgb(light.card))).toBeLessThan(4.5)
  })

  it('is the accent itself in the dark theme, which reads at AA on its tints there', () => {
    expect(dark['primary-text']).toBe(dark.primary)
    for (const surface of ['page', 'card']) {
      for (const alpha of TINTS.filter(each => each <= 0.15)) {
        const behind = tint(dark.primary, alpha, dark[surface])
        expect(contrast(rgb(dark['primary-text']), behind)).toBeGreaterThan(4.5)
      }
    }
  })
})
