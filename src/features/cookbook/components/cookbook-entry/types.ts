import type { CookbookRead } from '../cookbook-card/types'
import type { CookbookPlace } from '@/types/cookbook'

/** What the modal a player's Magical Recipe Book opens in is drawn from. */
export type CookbookEntryDialogsProps = {
  isOpen: boolean
  close: () => void
  read: CookbookRead
  place: CookbookPlace
}
