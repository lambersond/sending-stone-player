'use client'

import { useTransition } from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/clients/auth-client'

export function SignOutButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const signOut = () =>
    startTransition(async () => {
      await authClient.signOut()
      router.push('/')
      router.refresh()
    })

  return (
    <button
      type='button'
      onClick={signOut}
      disabled={pending}
      className='inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary disabled:opacity-50'
    >
      <LogOut aria-hidden className='size-4' />
      <span className='max-sm:sr-only'>Sign out</span>
    </button>
  )
}
