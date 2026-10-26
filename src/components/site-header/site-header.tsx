import { Suspense } from 'react'
import Link from 'next/link'
import { HeaderAccount } from './header-account'
import { NotOnCharacterPage } from './not-on-character-page'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteHeader() {
  return (
    // A character's page has none: its game takes the whole screen.
    <NotOnCharacterPage>
      <header className='h-14 border-b border-border bg-card/80 backdrop-blur'>
        {/* On a phone the gaps close up, and the name gets smaller below 390px and goes below
            360px, so the account's buttons keep their size and nothing runs off the side. As wide
            as the campaigns page's box (round 0.39.0), so their edges meet. */}
        <div className='mx-auto flex h-full w-full max-w-[70rem] items-center justify-between gap-2 px-4 sm:gap-4'>
          <Link
            href='/'
            className='inline-flex shrink-0 items-center gap-2 font-semibold tracking-tight'
          >
            <Logo variant='mark' className='size-5' />
            <span className='max-[390px]:text-sm max-[360px]:sr-only'>
              Sending Stone
            </span>
          </Link>
          <div className='flex min-w-0 items-center gap-1 sm:gap-2'>
            <ThemeToggle />
            {/* Reading the session waits on the database; let the rest of the page stream
                first. */}
            <Suspense>
              <HeaderAccount />
            </Suspense>
          </div>
        </div>
      </header>
    </NotOnCharacterPage>
  )
}
