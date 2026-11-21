'use client'

import { useState } from 'react'
import { Maximize, Minimize } from 'lucide-react'
import { useFullscreen } from '@/components/fullscreen-button/use-fullscreen'
import { Modal } from '@/components/modal/modal'
import { TABLE_HEADER_BOX, TABLE_HEADER_BUTTON } from '@/constants/buttons'
import { useHydrated } from '@/hooks/use-hydrated'

/** Its glyph's size, and its room's until the page hydrates. */
const GLYPH = 'size-4'

/**
 * Fills the screen with the page, as a video does, and back. On an iPhone, which lets no website
 * do that, it explains how to add the app to the Home Screen instead, where it opens without
 * Safari's bars; there, it shows nothing. Before the page has hydrated, its room, empty, so that
 * what stands beside it in a header stands where it will (ROADMAP item 82). Once hydrated, nothing
 * in a browser that can't fill the screen, nor in the iPhone Home Screen app, where the room
 * closes.
 */
export function FullscreenButton() {
  const { supported, standalone, ios, active, enter, exit } = useFullscreen()
  const hydrated = useHydrated()
  const [explaining, setExplaining] = useState(false)

  if (!hydrated) {
    return (
      <span aria-hidden className={TABLE_HEADER_BOX}>
        <span className={GLYPH} />
      </span>
    )
  }
  if (supported) {
    const label = active ? 'Exit full screen' : 'Full screen'
    const Icon = active ? Minimize : Maximize
    return (
      <button
        type='button'
        aria-label={label}
        title={label}
        onClick={active ? exit : enter}
        className={TABLE_HEADER_BUTTON}
      >
        <Icon aria-hidden className={GLYPH} />
      </button>
    )
  }
  if (!ios || standalone) return
  return (
    <>
      <button
        type='button'
        aria-label='Full screen'
        title='Full screen'
        onClick={() => setExplaining(true)}
        className={TABLE_HEADER_BUTTON}
      >
        <Maximize aria-hidden className={GLYPH} />
      </button>
      <Modal
        open={explaining}
        onClose={() => setExplaining(false)}
        title='Full screen on iPhone'
      >
        <div className='grid gap-6'>
          <div className='grid gap-2 text-sm text-text-secondary'>
            <p>
              iPhone doesn&apos;t let websites fill the whole screen. Add
              Sending Stone to your Home Screen instead: it opens there without
              Safari&apos;s bars.
            </p>
            <p>
              In Safari, tap Share, then Add to Home Screen, and open Sending
              Stone from your Home Screen. You&apos;ll sign in once more there.
            </p>
          </div>
          <div className='flex justify-end'>
            <button
              type='button'
              onClick={() => setExplaining(false)}
              className='h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover'
            >
              Got it
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
