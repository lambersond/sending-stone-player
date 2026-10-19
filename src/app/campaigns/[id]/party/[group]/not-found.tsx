import { Users } from 'lucide-react'
import Link from 'next/link'

/**
 * For a Gamemaster's party sheet that isn't theirs to open, or is no longer there: the same for
 * every cause, so that it says nothing of another's campaign.
 */
export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-12 text-center'>
      <Users aria-hidden className='size-8 text-primary' />
      <h1 className='mt-4 text-lg font-semibold'>
        This party sheet isn&apos;t open here. Its group may have left the
        campaign.
      </h1>
      <Link
        href='/campaigns'
        className='mt-6 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary/10'
      >
        Your campaigns
      </Link>
    </main>
  )
}
