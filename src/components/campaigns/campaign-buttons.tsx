'use client'

import { useState } from 'react'
import { Info, Plus } from 'lucide-react'
import { CampaignSetupForm } from './campaign-setup-form'
import { ConnectSteps } from './connect-steps'
import { Modal } from '@/components/modal'
import type { CampaignSetupFormState } from '@/types/campaign'

type NewCampaignProps = {
  action: (
    state: CampaignSetupFormState,
    formData: FormData,
  ) => Promise<CampaignSetupFormState>
  suggestedSecret: string
}

/** Opens the form for setting up a campaign. */
export function NewCampaignButton({
  action,
  suggestedSecret,
}: Readonly<NewCampaignProps>) {
  const [open, setOpen] = useState(false)
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
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}

/** Opens how to connect Foundry to this app. */
export function ConnectFoundryButton({
  destination,
}: Readonly<{ destination: string }>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
      >
        <Info aria-hidden className='size-4' />
        Connect Foundry
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title='Connect your Foundry game'
      >
        <ConnectSteps destination={destination} />
      </Modal>
    </>
  )
}
