import { Dices } from 'lucide-react'

/** Said in a roll's place while its dice tumble over the page, before they land. */
export function RollingLine() {
  return (
    <p className='flex items-center gap-2 text-sm font-semibold'>
      <Dices
        aria-hidden
        className='size-5 shrink-0 text-primary motion-safe:animate-spin'
      />
      Rolling…
    </p>
  )
}
