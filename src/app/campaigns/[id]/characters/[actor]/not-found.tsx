import { UserRound } from 'lucide-react'
import Link from 'next/link'

/**
 * For a Gamemaster's character sheet that isn't theirs to open, or is no longer there (#156): the
 * same for every cause, so that it says nothing of another's campaign. It also catches a sheet
 * whose character has left the campaign while it was open.
 */
export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-12 text-center'>
      <UserRound aria-hidden className='size-8 text-primary' />
      <h1 className='mt-4 text-lg font-semibold'>
        This sheet isn&apos;t open here. Its character may have left the
        campaign.
      </h1>
      <Link
        href='/campaigns'
        className='mt-6 rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10'
      >
        Your campaigns
      </Link>
    </main>
  )
}
