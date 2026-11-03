import { EyeOff } from 'lucide-react'

/** Said of a roll from a description the game didn't take, which no one else sees. */
export function OnlyYou() {
  return (
    <p className='mt-1 flex items-center gap-1.5 text-xs text-text-secondary'>
      <EyeOff aria-hidden className='size-3.5 shrink-0' />
      Only you see this roll
    </p>
  )
}
