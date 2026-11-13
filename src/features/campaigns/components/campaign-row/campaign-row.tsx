import clsx from 'clsx'
import { CircleAlert, Plug } from 'lucide-react'
import { CampaignStatus } from '../campaign-status/campaign-status'
import { LastHeard } from '../campaign-status/last-heard'
import { SeatAvatars } from '../seat-avatars/seat-avatars'
import { CAMPAIGN_ROW } from '@/features/campaigns/constants'
import type { CampaignRowData } from '@/features/campaigns/types'

/**
 * A campaign in the index: a button that opens it, its name all its text, the seats' circles
 * hidden. Its title and line cut short on one line each; its chip on the right; and across the
 * foot, what it needs of its Gamemaster, else its seats, then when Foundry was last heard.
 * Marked current where it's the campaign shown beside the list, once the page knows it is.
 */
export function CampaignRow({
  row,
  current,
  onChoose,
}: Readonly<{ row: CampaignRowData; current: boolean; onChoose: () => void }>) {
  return (
    <button
      type='button'
      data-campaign={row.id}
      aria-current={current ? 'true' : undefined}
      onClick={onChoose}
      className={clsx(
        CAMPAIGN_ROW,
        'text-left transition-colors',
        current
          ? 'border-primary bg-primary/4 shadow-[inset_3px_0_0_var(--color-primary)]'
          : 'border-border hover:border-primary/40',
      )}
    >
      <span className='min-w-0'>
        <span className='block truncate text-[15px] font-semibold'>
          {row.title}
        </span>
        <span className='block truncate text-[13px] text-text-secondary'>
          {row.sub}
        </span>
      </span>
      <span>
        <CampaignStatus state={row.state} />
      </span>
      <span className='col-span-full flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5'>
        {row.flag ? (
          <Flag flag={row.flag} />
        ) : (
          <SeatAvatars seats={row.seats} />
        )}
        <LastHeard campaign={row} />
      </span>
    </button>
  )
}

/** What a campaign needs of its Gamemaster, on its row: a refusal, or a first connection. */
function Flag({
  flag,
}: Readonly<{ flag: NonNullable<CampaignRowData['flag']> }>) {
  const refused = flag.attention === 'refused'
  const Icon = refused ? CircleAlert : Plug
  return (
    <span
      className={clsx(
        'inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold',
        refused ? 'text-danger' : 'text-warning',
      )}
    >
      <Icon aria-hidden className='size-4 shrink-0' />
      {flag.text}
    </span>
  )
}
