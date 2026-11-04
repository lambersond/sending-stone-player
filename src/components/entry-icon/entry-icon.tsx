'use client'

import clsx from 'clsx'
import { useImageFallback } from '@/hooks/use-image-fallback'
import type { LucideIcon } from 'lucide-react'

/** An entry's icon from the game, or its fallback when it has none or it fails to load. */
export function EntryIcon({
  src,
  fallback: Fallback,
}: Readonly<{ src?: string | null; fallback: LucideIcon }>) {
  const { shown, ref, onError } = useImageFallback(src)
  const box = 'size-8 shrink-0 rounded-lg border border-border'
  if (!src || !shown) {
    return (
      <span
        aria-hidden
        className={clsx(
          box,
          'flex items-center justify-center bg-primary/10 text-primary',
        )}
      >
        <Fallback className='size-4' />
      </span>
    )
  }
  return (
    // An icon from the Gamemaster's game, which Next's image optimizer doesn't know.
    // eslint-disable-next-line @next/next/no-img-element -- the game's image, not Next's
    <img
      ref={ref}
      src={src}
      alt=''
      className={clsx(
        box,
        // The game's own SVG icons, such as its status icons, are white, made for its dark
        // controls.
        isSvg(src) ? 'bg-[#23232f] p-1' : 'bg-card object-cover',
      )}
      onError={onError}
    />
  )
}

function isSvg(src: string): boolean {
  try {
    return new URL(src).pathname.toLowerCase().endsWith('.svg')
  } catch {
    return false
  }
}
