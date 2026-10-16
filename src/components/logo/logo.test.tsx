import { existsSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { Logo } from './logo'

/** Every image a logo's srcset names, as files under public/. */
function sources(img: HTMLImageElement): string[] {
  return (img.getAttribute('srcset') ?? '')
    .split(',')
    .map(entry => entry.trim().split(' ', 1)[0])
}

describe('components/logo', () => {
  it.each([
    ['mark', 20, 'stone-mark'],
    ['icon', 72, 'stone-icon'],
  ] as const)(
    'draws the %s at %ipx, at each pixel density, from images that exist',
    (variant, size, name) => {
      const { container } = render(<Logo variant={variant} />)
      const img = container.querySelector('img')!

      expect(img).toHaveAttribute('src', `/brand/${name}-${size}.png`)
      expect(img).toHaveAttribute('width', String(size))
      expect(img).toHaveAttribute('height', String(size))
      expect(sources(img)).toEqual(
        [1, 2, 3].map(x => `/brand/${name}-${size * x}.png`),
      )
      for (const source of sources(img)) {
        expect(existsSync(path.join(process.cwd(), 'public', source))).toBe(
          true,
        )
      }
    },
  )

  it('is decorative: the words beside it name it', () => {
    const { container } = render(<Logo variant='mark' className='size-5' />)
    const img = container.querySelector('img')!

    expect(img).toHaveAttribute('alt', '')
    expect(img).toHaveClass('size-5')
  })
})
