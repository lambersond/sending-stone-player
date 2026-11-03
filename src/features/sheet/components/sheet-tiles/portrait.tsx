'use client'

import clsx from 'clsx'
import { useImageFallback } from '@/hooks/use-image-fallback'

/** A character's or creature's portrait, or its initials where it has none or it won't load. */
export function Portrait({
  name,
  src,
}: Readonly<{ name: string; src?: string }>) {
  const { shown, ref, onError } = useImageFallback(src)
  const box =
    'size-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-primary/10'
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=''
      className={clsx(box, 'object-cover object-top')}
      onError={onError}
    />
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('')
}
