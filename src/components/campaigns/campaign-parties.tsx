import { Users } from 'lucide-react'
import Link from 'next/link'
import type { OwnedCampaign } from '@/types/campaign'

/**
 * A campaign's party sheets, for its Gamemaster to open (module 0.30.0), each saying whether it's
 * dnd5e's primary party, and where no player may see it in Foundry. Nothing for none.
 */
export function CampaignParties({
  campaign,
}: Readonly<{ campaign: Pick<OwnedCampaign, 'id' | 'groups'> }>) {
  if (campaign.groups.length === 0) return
  return (
    <section className='grid gap-2'>
      <h4 className='flex items-center gap-1.5 text-sm font-medium'>
        <Users aria-hidden className='size-4 text-text-secondary' />
        Party sheets
      </h4>
      <ul className='grid gap-1.5 text-sm'>
        {campaign.groups.map(group => (
          <li
            key={group.id}
            className='flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg bg-page px-3 py-1'
          >
            <Link
              href={`/campaigns/${campaign.id}/party/${group.id}`}
              aria-label={`Open ${group.name}'s party sheet`}
              className='min-w-0 truncate font-medium text-text-primary underline-offset-2 hover:text-primary hover:underline'
            >
              {group.name}
            </Link>
            <span className='flex flex-wrap items-center gap-x-2 text-xs'>
              {group.primary && (
                <span className='font-semibold text-primary'>
                  Primary party
                </span>
              )}
              {!group.shared && (
                <span className='text-warning'>
                  Not shared with any player in Foundry
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
