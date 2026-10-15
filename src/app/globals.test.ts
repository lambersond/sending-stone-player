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
