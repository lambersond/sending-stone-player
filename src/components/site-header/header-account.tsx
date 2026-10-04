import { Flag } from 'lucide-react'
import Link from 'next/link'
import { Avatar } from '@/components/avatar'
import { SignOutButton } from '@/components/sign-out-button'
import { getCurrentUser } from '@/lib/session'

export async function HeaderAccount() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <Link
        href='/login'
        className='rounded-lg px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10'
      >
        Sign in
      </Link>
    )
  }

  return (
    <nav aria-label='Account' className='flex min-w-0 items-center gap-2'>
      <Link
        href='/campaigns'
        className='inline-flex items-center gap-1.5 rounded-lg p-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary sm:px-2.5'
      >
        <Flag aria-hidden className='size-4' />
        <span className='max-sm:sr-only'>Campaigns</span>
      </Link>
      <Link
        href='/characters'
        className='inline-flex min-w-0 items-center gap-2 rounded-lg p-1 text-sm font-medium transition-colors hover:bg-primary/10 sm:pr-2.5'
      >
        <Avatar name={user.name} image={user.image} className='size-7' />
        <span className='max-w-40 truncate max-sm:sr-only'>{user.name}</span>
      </Link>
      <SignOutButton />
    </nav>
  )
}
