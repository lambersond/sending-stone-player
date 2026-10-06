import type { ReactNode, RefObject } from 'react'

/**
 * A scrolling area of the table. It is positioned so that what is placed absolutely inside it,
 * such as text only for screen readers, scrolls with it rather than stretching the page.
 */
export function Scroller({
  ref,
  onScroll,
  children,
}: Readonly<{
  ref?: RefObject<HTMLDivElement | null>
  onScroll?: () => void
  children: ReactNode
}>) {
  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className='@container relative min-h-0 min-w-0 flex-1 overflow-y-auto'
    >
      {children}
    </div>
  )
}
