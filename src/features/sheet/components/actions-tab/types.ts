import type { ActionGroup, SheetActionSection } from '@/types/sending-stone'

/** A section, with its heading's id and its actions in their groups. */
export type GroupedSection = SheetActionSection & {
  headingId: string
  groups: ActionGroup[]
}

/** Whether each group is open, and what opens or closes it. */
export type Groups = {
  isOpen: (group: ActionGroup) => boolean
  toggle: (group: ActionGroup) => void
}
