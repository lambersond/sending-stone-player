import { Suspense } from 'react'
import { Gem } from 'lucide-react'
import Link from 'next/link'
import { HeaderAccount } from './header-account'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteHeader() {
  return (
    // h-14, border included: the game table fills the viewport below it
    <header className='h-14 border-b border-border bg-card/80 backdrop-blur'>
      <div className='mx-auto flex h-full w-full max-w-3xl items-center justify-between gap-4 px-4'>
        <Link
          href='/'
          className='inline-flex shrink-0 items-center gap-2 font-semibold tracking-tight'
        >
          <Gem aria-hidden className='size-5 text-primary' />
          Sending Stone
        </Link>
        <div className='flex min-w-0 items-center gap-2'>
          <ThemeToggle />
          {/* Reading the session waits on the database; let the rest of the page stream first. */}
          <Suspense>
            <HeaderAccount />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
