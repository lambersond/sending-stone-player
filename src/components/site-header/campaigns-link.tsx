'use client'

import clsx from 'clsx'
import { Flag } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CAMPAIGNS_PATH } from '@/constants/campaign'

/**
 * The header's way to the Gamemaster's campaigns, marked as the page shown, and tinted, while it
 * is (round 0.39.0). On a phone, its icon alone, its word for screen readers.
 */
export function CampaignsLink() {
  const here = usePathname() === CAMPAIGNS_PATH
  return (
    <Link
      href={CAMPAIGNS_PATH}
      aria-current={here ? 'page' : undefined}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg p-1.5 text-sm font-medium transition-colors hover:bg-primary/10 hover:text-text-primary sm:px-2.5',
        here ? 'bg-primary/10 text-text-primary' : 'text-text-secondary',
      )}
    >
      <Flag aria-hidden className='size-4' />
      <span className='max-sm:sr-only'>Campaigns</span>
    </Link>
  )
}
