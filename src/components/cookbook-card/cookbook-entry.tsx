'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CookbookPanel } from './cookbook-card'
import { Modal } from '@/components/modal'
import { useCookbookView } from '@/hooks/use-cookbook-view'
import type { CookbookPlace } from '@/types/cookbook'

/** What the cog's entry, and the no-sheet view's button, are called (round 0.39.0, →Q7). */
export const CONFIGURE_COOKBOOK = 'Configure Magical Cookbook'

/** Nowhere: where no Magical Recipe Book is offered, its hooks read nothing. */
const NO_PLACE = ''

/**
 * Where a player's Magical Recipe Book is opened from, since round 0.39.0: the sheet's cog, or the
 * no-sheet view's button. It reads the book once as it mounts, and again each time the cog opens,
 * as the hook reads nothing while its modal is closed; it's offered (`shown`) once a read says the
 * game takes dishes or the character has a link, so no one makes a code before their Gamemaster
 * takes dishes, and dishes turned on mid-session show it the next time the cog opens. The modal,
 * which reads every poll while it's open, stays mounted while it's open whatever `shown` says, as
 * after a revoke while the game takes no dishes; closed, it gives focus back to what opened it.
 * @param place - The player's own seat's character and its actions; none, as at a creature's pane
 *   or the Gamemaster's page, for nothing.
 */
export function useCookbookEntry(place?: CookbookPlace): {
  shown: boolean
  /** Called as the cog opens and closes: a read as it opens. */
  onCogOpenChange: (open: boolean) => void
  open: () => void
  close: () => void
  modal: ReactNode
} {
  const [isOpen, setOpen] = useState(false)
  // Gone from where it was opened, as the no-sheet view once the sheet comes: closed, so that it
  // never opens again by itself.
  if (!place && isOpen) setOpen(false)
  const read = useCookbookView(place?.characterId ?? NO_PLACE, {
    active: isOpen && place !== undefined,
  })
  const { view, reload } = read
  // What had focus as it opened, such as the cog's own Settings button, to give it back to.
  const opener = useRef<HTMLElement>(undefined)
  const placed = place !== undefined
  useEffect(() => {
    if (placed) void reload()
  }, [placed, reload])

  const onCogOpenChange = useCallback(
    (open: boolean) => {
      if (open && placed) void reload()
    },
    [placed, reload],
  )
  const open = useCallback(() => {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined
    setOpen(true)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  // Once its dialog has closed: the browser gives focus back as it does, and this does where it
  // didn't, focus left on the page or in the dialog, as where what had focus was gone meanwhile.
  useEffect(() => {
    const back = opener.current
    if (isOpen || !back) return
    opener.current = undefined
    const active = document.activeElement
    if (
      back.isConnected &&
      (!active || active === document.body || active.closest('dialog'))
    ) {
      back.focus()
    }
  }, [isOpen])

  const modal = place && (
    <Modal
      open={isOpen}
      onClose={close}
      title='Magical Recipe Book'
      fullOnPhone
    >
      <CookbookPanel {...read} make={place.make} revoke={place.revoke} />
    </Modal>
  )
  return {
    shown: !!view && (view.enabled || !!view.link),
    onCogOpenChange,
    open,
    close,
    modal,
  }
}
