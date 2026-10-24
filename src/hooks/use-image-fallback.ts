'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Whether a picture from the Gamemaster's game is drawn, or its fallback (module 0.36.0's round):
 * its fallback where it has no address, or it won't load, whether its error reaches React or came
 * first, as on a page drawn on the server, before React was there to hear it. Once mounted, an
 * image done loading with nothing it can decode has failed too; one without a size of its own, as
 * an SVG may be, decodes, and stays.
 */
export function useImageFallback(src: string | null | undefined): {
  /** Draw the image: it has an address, and it hasn't failed. */
  shown: boolean
  /** The image's own, which its check once mounted reads. */
  ref: RefObject<HTMLImageElement | null>
  /** For the image's `onError`. */
  onError: () => void
} {
  // The address that failed, not just whether one did, so that a new one is tried afresh.
  const [failed, setFailed] = useState<string>()
  const ref = useRef<HTMLImageElement>(null)
  // An image still loading is left to its error event, which React now hears; one with a size
  // has loaded.
  useEffect(() => {
    const img = ref.current
    if (!src || !img?.complete || img.naturalWidth > 0) return
    img.decode().catch(() => setFailed(src))
  }, [src])
  return {
    shown: Boolean(src) && failed !== src,
    ref,
    onError: () => {
      if (src) setFailed(src)
    },
  }
}
