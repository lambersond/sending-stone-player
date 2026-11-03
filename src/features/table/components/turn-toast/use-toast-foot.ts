import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Where the turn's toast's card ends, for the roll toasts to start below it, as it shows, moves,
 * changes or goes.
 * @param onFoot - Told where the card ends, in pixels from the top, or that none shows.
 * @param top - Where the toast starts, which moves the card with it.
 * @returns The card's ref, which measures it.
 */
export function useToastFoot(
  onFoot: ((foot: number | undefined) => void) | undefined,
  top: number | undefined,
) {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const foot = useRef<number | undefined>(undefined)
  const footing = useRef(onFoot)
  useLayoutEffect(() => {
    footing.current = onFoot
  })
  useLayoutEffect(() => {
    // Where the card comes to rest, not where its entry has it now: its box as laid out in its
    // region, which a transform doesn't move, as the card's first frame already has it 8 pixels
    // higher and no resize follows to say otherwise.
    const measure = () => {
      const at = element
        ? Math.ceil(
            (element.parentElement?.getBoundingClientRect().top ?? 0) +
              element.offsetTop +
              element.offsetHeight,
          )
        : undefined
      if (at === foot.current) return
      foot.current = at
      footing.current?.(at)
    }
    measure()
    if (!element) return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    globalThis.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      globalThis.removeEventListener('resize', measure)
    }
  }, [element, top])
  return setElement
}
