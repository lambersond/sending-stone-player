import { CookbookPanel } from '../cookbook-card/cookbook-card'
import { Modal } from '@/components/modal/modal'
import type { CookbookEntryDialogsProps } from './types'

/** The modal a player's Magical Recipe Book opens in, its panel reading the book while open. */
export function CookbookEntryDialogs({
  isOpen,
  close,
  read,
  place,
}: Readonly<CookbookEntryDialogsProps>) {
  return (
    <Modal
      open={isOpen}
      onClose={close}
      title='Magical Recipe Book'
      fullOnPhone
    >
      <CookbookPanel {...read} make={place.make} revoke={place.revoke} />
    </Modal>
  )
}
