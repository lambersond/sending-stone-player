'use client'

import clsx from 'clsx'
import { initials } from './utils'
import { useImageFallback } from '@/hooks/use-image-fallback'

/**
 * A character's or creature's portrait, or its initials where it has none or it won't load.
 * @param dashed - Ringed in dashes in place of its border, as a constant companion on no scene is,
 *   from module 0.54.0.
 */
export function Portrait({
  name,
  src,
  dashed = false,
}: Readonly<{ name: string; src?: string; dashed?: boolean }>) {
  const { shown, ref, onError } = useImageFallback(src)
  const box = clsx(
    'size-16 shrink-0 overflow-hidden rounded-2xl bg-primary/10',
    dashed
      ? 'border-[1.5px] border-dashed border-primary-text'
      : 'border border-border',
  )
  if (!shown) {
    return (
      <span
        aria-hidden
        className={clsx(
          box,
          'flex items-center justify-center text-lg font-bold text-primary-text',
        )}
      >
        {initials(name)}
      </span>
    )
  }
  return (
    // A portrait from the Gamemaster's game, which Next's image optimizer doesn't know.
    // eslint-disable-next-line @next/next/no-img-element -- the game's image, not Next's
    <img
      ref={ref}
      src={src}
      alt=''
      className={clsx(box, 'object-cover object-top')}
      onError={onError}
    />
  )
}
