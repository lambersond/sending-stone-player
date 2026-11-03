'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { ConnectSteps } from '../connect-steps/connect-steps'
import { Modal } from '@/components/modal/modal'

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
