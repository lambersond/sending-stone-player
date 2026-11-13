import { RUNE } from './constants'
import { Logo } from '@/components/logo/logo'

/**
 * The stone while a page's data loads (v0.48.0), once the page knows it may be shown: the app
 * icon in the middle of the page's main part, below the site's header where the page shows it
 * (a character's sheet, at the player's seat or the Gamemaster's, doesn't), its carved rune
 * lighting a part at a time and going dark again, over and over, as globals.css's rune keyframes
 * time it. Someone who'd rather nothing moved sees it lit and still. It says "Loading…" to a
 * screen reader; the light is only for the eye.
 */
export function LoadingStone() {
  return (
    <div className='flex flex-1 items-center justify-center px-4 py-16'>
      <div role='status' className='relative size-24'>
        <Logo variant='loading' className='block size-24' />
        {/* The light glows as the approved design's does at 144px, its shadows scaled to 96px. */}
        <svg
          viewBox={RUNE.viewBox}
          aria-hidden
          className='pointer-events-none absolute inset-0 size-full mix-blend-screen drop-shadow-[0_0_1.33px_var(--color-rune-glow),0_0_5.33px_var(--color-rune-glow)]'
        >
          <circle
            {...RUNE.dot}
            className='fill-rune-glow opacity-0 motion-safe:animate-rune-dot motion-reduce:opacity-85'
          />
          <g
            fill='none'
            strokeWidth={RUNE.arcWidth}
            strokeLinecap='round'
            className='stroke-rune-glow'
          >
            <path
              d={RUNE.inner}
              className='opacity-0 motion-safe:animate-rune-inner motion-reduce:opacity-85'
            />
            <path
              d={RUNE.outer}
              className='opacity-0 motion-safe:animate-rune-outer motion-reduce:opacity-85'
            />
          </g>
        </svg>
        <span className='sr-only'>Loading…</span>
      </div>
    </div>
  )
}
