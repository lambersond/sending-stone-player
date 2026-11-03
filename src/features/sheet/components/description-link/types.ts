import type {
  DamageSubject,
  MenuItem,
  MenuPoint,
  RollTarget,
} from '@/features/rolling/types'
import type { ActivityRef, TextLink } from '@/types/roll'
import type { CheckOption } from '@/types/sending-stone'

/** A menu a description's link opens: where, what it's of, its items, and what each does. */
export type OpenMenu = {
  anchor: HTMLElement
  /** Where on the link the player clicked or pressed for it; below the link with none. */
  point?: MenuPoint
  title: string
  items: MenuItem<string>[]
  onChoose: (id: string) => void
}

/**
 * The menus a description's links open, and the dialogs that modify a saving throw or check, or
 * damage, first.
 */
export type LinkMenus = {
  open: (menu: OpenMenu) => void
  /** Modify a saving throw or check before it's rolled, against the DC its description names. */
  modify: (target: RollTarget, dc?: number) => void
  /**
   * The other ways to roll a description's damage or healing: as a critical hit's, at its highest,
   * or changed first.
   */
  damage: (
    anchor: HTMLElement,
    subject: DamageSubject,
    point?: MenuPoint,
  ) => void
}

/**
 * One way a check may be made, as a check a description or an activity calls for has it: for an
 * activity's tool check made with the tool it's of, with the tool's own bonus, which dnd5e adds.
 */
export type CheckWay = CheckOption & { bonus?: number }

/** What a check is rolled for, for the game to make it too: a description's link, or activity. */
export type CheckFrom = TextLink | ActivityRef

/** A saving throw or check being modified before it's rolled, against the DC its link names. */
export type Modifying = {
  target: RollTarget
  dc?: number
}
