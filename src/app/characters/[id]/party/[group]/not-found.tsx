import { Users } from 'lucide-react'
import Link from 'next/link'

/**
 * For a party sheet that isn't the player's to open, or is no longer there: the same for every
 * cause, so that it says nothing of who may see it.
 */
export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-12 text-center'>
      <Users aria-hidden className='size-8 text-primary' />
      <h1 className='mt-4 text-lg font-semibold'>
        This party sheet isn&apos;t open here.
      </h1>
      <Link
        href='/characters'
        className='mt-6 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary/10'
      >
        All characters
      </Link>
    </main>
  )
}
