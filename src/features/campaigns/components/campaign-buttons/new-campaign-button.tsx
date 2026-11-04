'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { CampaignSetupForm } from '../campaign-setup-form/campaign-setup-form'
import { Modal } from '@/components/modal/modal'
import { useCampaignChoice } from '@/features/campaigns/hooks/use-campaign-choice'
import type { NewCampaignProps } from './types'

/**
 * Opens the form for setting up a campaign. Done chooses the campaign just set up, on the
 * campaigns page (round 0.39.0), as its row would.
 */
export function NewCampaignButton({
  action,
  suggestedSecret,
}: Readonly<NewCampaignProps>) {
  const [open, setOpen] = useState(false)
  const { choose } = useCampaignChoice()
  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover'
      >
        <Plus aria-hidden className='size-4' />
        New campaign
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title='New campaign'>
        <CampaignSetupForm
          action={action}
          suggestedSecret={suggestedSecret}
          onDone={id => {
            setOpen(false)
            choose(id)
          }}
        />
      </Modal>
    </>
  )
}
