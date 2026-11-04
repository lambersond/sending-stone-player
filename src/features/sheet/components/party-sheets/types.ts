import type { TableGroup } from '@/types/party'

/** The party sheets a seat at the character's sheet may open, and how one is opened. */
export type PartySheets = {
  groups: TableGroup[]
  /** Opens a group's sheet in its side panel, by its id. */
  onOpen: (group: string) => void
}
