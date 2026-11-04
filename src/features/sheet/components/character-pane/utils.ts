import {
  Backpack,
  BookOpen,
  ChessKnight,
  Feather,
  ListChecks,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { isItemCast } from '@/utils/casts'
import { rollsAny } from '@/utils/favorites'
import { reasons } from '@/utils/roll-reasons'
import { seatWords } from '@/utils/seat-words'
import type { PaneTable, SheetTab, TabEntry } from './types'
import type { SheetSettingsProps } from '../sheet-settings/types'
import type { Picked, Picking } from '../use-picker/types'
import type { useCookbookEntry } from '@/features/cookbook/hooks/use-cookbook-entry'
import type { RollKind, RollSource, SheetRoll } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { FavoriteEntry, SheetAction } from '@/types/sending-stone'
import type { CreatureFacts, TableCombat, TableSheet } from '@/types/table'

/** Why the game takes neither, as the tray says it, by what a description's link asks of it. */
const NOT_TAKEN = {
  ask: (game: string) => `${game} can’t be asked from Sending Stone yet`,
  use: (game: string) => `${game} isn’t taking spells and features`,
} as const

/**
 * Why the table can't be asked from here now for what a description calls for, as the tray says
 * why a roll wasn't made: a saving throw or check (`ask`), or a spell or feature used in the game
 * (`use`), as an activity's check asks the table by using it; nothing while it can be.
 * @param kinds - The rolls the game takes now.
 */
export function blockedReason(
  kind: 'ask' | 'use',
  table: Pick<PaneTable, 'takes' | 'available'>,
  role: SeatRole,
  kinds: readonly RollKind[] = [],
): string | undefined {
  if (table.takes(kind)) return undefined
  if (!table.available) return reasons(role).unavailable
  if (!kinds.includes(kind)) return NOT_TAKEN[kind](seatWords(role).game)
  return 'this device doesn’t send your rolls to the table'
}

/**
 * An attack of a spell an item casts, such as a staff's Guiding Bolt, marked as one: it's cast at a
 * level the item offers, not with a slot, which the tray says where the game refuses it.
 */
export function itemCastOf(action: SheetAction): { itemCast?: true } {
  return isItemCast(action) ? { itemCast: true } : {}
}

/** Damage on its own's choices as picked (module 0.41.0): those made, and no others. */
export function alonePicked({ slot, attackMode, ammunition, consume }: Picked) {
  return {
    ...(slot && { slot }),
    ...(attackMode && { attackMode }),
    ...(ammunition && { ammunition }),
    ...(consume && { consume }),
  }
}

/**
 * An attack's roll as picked: an area attack, where the game makes it at those picked, at those in
 * its area (`area`); any other at the combatant picked. A combat that ended while they picked
 * leaves no one to attack.
 */
export function pickedAttack(
  asked: Extract<Picking, { kind: 'attack' }>,
  source: Extract<RollSource, { kind: 'attack' }>,
  { targets, slot, ammunition, attackMode }: Picked,
  combat: TableCombat | undefined,
  area: boolean,
): SheetRoll {
  if (area) {
    const caught = combat ? targets : []
    return {
      ...asked.request,
      source: {
        ...source,
        targets: combat
          ? caught.map(({ id }) => ({ combatId: combat.id, combatantId: id }))
          : [],
        slot,
        ammunition,
        attackMode,
      },
      targetNames: Object.fromEntries(caught.map(({ id, name }) => [id, name])),
      ...itemCastOf(asked.action),
    }
  }
  const [combatant] = targets
  const target =
    combatant && combat
      ? { combatId: combat.id, combatantId: combatant.id }
      : undefined
  return {
    ...asked.request,
    source: { ...source, target, slot, ammunition, attackMode },
    ...itemCastOf(asked.action),
  }
}

/**
 * The parts of the sheet, in the order Tidy 5e's character sheet has them, with dnd5e's icons for
 * them where it has them, and Tidy's for Actions. Spells is only for a character who casts them.
 */
const TABS: TabEntry[] = [
  { id: 'character', label: 'Character', icon: UserRound },
  { id: 'actions', label: 'Actions', icon: ChessKnight },
  { id: 'inventory', label: 'Inventory', icon: Backpack },
  { id: 'spells', label: 'Spells', icon: BookOpen },
  { id: 'features', label: 'Features', icon: ListChecks },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'biography', label: 'Biography', icon: Feather },
]

/**
 * The sheet's tabs: Spells only for a character who casts them; a creature's, from module 0.36.0,
 * only where its sheet has something for them.
 */
export function visibleTabs(
  sheet: TableSheet,
  creature: CreatureFacts | undefined,
): TabEntry[] {
  const casts =
    sheet.spellcasting !== null ||
    sheet.spells.some(section => section.spells.length > 0)
  return TABS.filter(
    ({ id }) => (id !== 'spells' || casts) && (!creature || hasFor(sheet, id)),
  )
}

/**
 * Whether a creature's sheet has something for one of its tabs (module 0.36.0): Inventory where it
 * lists an item or a container, or has a coin, as the module lists every coin, at none too;
 * Effects where it has an effect or a condition; Biography where it has more than its alignment,
 * which the creature line already says. The rest always, Spells as a character's.
 */
function hasFor(sheet: TableSheet, tab: SheetTab): boolean {
  const { inventory, details } = sheet
  switch (tab) {
    case 'inventory': {
      return (
        inventory.sections.length > 0 ||
        inventory.containers.length > 0 ||
        inventory.currency.some(({ value }) => value > 0)
      )
    }
    case 'effects': {
      return (
        sheet.effects.some(({ effects }) => effects.length > 0) ||
        sheet.conditions.length > 0
      )
    }
    case 'biography': {
      return (
        Boolean(details.biography) ||
        Boolean(details.appearance) ||
        details.personality.length > 0 ||
        details.about.some(({ id }) => id !== 'alignment')
      )
    }
    default: {
      return true
    }
  }
}

/**
 * What the sheet's settings, behind its cog, offer: Send to the table, while the game takes any of
 * the player's rolls; where the game takes damage on its own, from module 0.36.0, this device's
 * switch, and from module 0.41.0 whether it takes its choices, which its hint says; where the game
 * lets the player type in their own dice, from module 0.32.0; toasts; the Actions tab's layouts,
 * where the sheet is wide enough for more than one and has actions; and the player's Magical
 * Recipe Book, at their own seat (`cookbookOn`), read again as the cog opens.
 */
export function paneSettings({
  table,
  manualDice,
  toasts,
  actionsLayout,
  hasActions,
  cookbookOn,
  cookbookEntry,
}: Readonly<{
  table: PaneTable
  manualDice?: SheetSettingsProps['manualDice']
  toasts: NonNullable<SheetSettingsProps['toasts']>
  actionsLayout: NonNullable<SheetSettingsProps['layouts']>
  hasActions: boolean
  cookbookOn: boolean
  cookbookEntry: Pick<
    ReturnType<typeof useCookbookEntry>,
    'shown' | 'onCogOpenChange' | 'open'
  >
}>): SheetSettingsProps {
  return {
    send: table.available
      ? { on: table.sending, onChange: table.setSending }
      : undefined,
    alone: table.aloneOffered
      ? {
          on: table.aloneOn,
          onChange: table.setAlone,
          disabled: !table.sending,
          choices: table.aloneChoices,
        }
      : undefined,
    manualDice,
    toasts,
    layouts:
      actionsLayout.offered.length > 1 && hasActions
        ? actionsLayout
        : undefined,
    onOpenChange: cookbookOn ? cookbookEntry.onCogOpenChange : undefined,
    cookbook: cookbookEntry.shown ? { onOpen: cookbookEntry.open } : undefined,
  }
}

/** The tabs things are rolled from, which the rolls are shown with. */
const ROLLING = new Set<SheetTab>([
  'character',
  'actions',
  'inventory',
  'spells',
  'features',
])

/**
 * Whether the tray shows the rolls, where the player has it rather than toasts: rolls are made
 * from the Character, Actions, Inventory, Spells and Features tabs, and from favorites, so it
 * shows there; and on any tab once something there made a roll or a command (`triggered`). The
 * rolls stay.
 */
export function showsRolls({
  tab,
  toasting,
  showsFavorites,
  entries,
  triggered,
}: Readonly<{
  tab: SheetTab
  toasting: boolean
  showsFavorites: boolean
  entries: FavoriteEntry[]
  triggered: boolean
}>): boolean {
  return (
    !toasting &&
    (ROLLING.has(tab) || (showsFavorites && rollsAny(entries)) || triggered)
  )
}

/**
 * What the pane offers its seat's player of the character, as the game takes each and the
 * campaign lets them: never at a creature's pane, and none of favorites, spells prepared and
 * effects changed while the character is transformed (`shaped`), as by Wild Shape (module 0.40.0),
 * whose form's sheet can't keep them; spells, effects and Wild Shape the player's alone, never the
 * Gamemaster's page's.
 * @param prepares - Whether the game takes spells prepared from here (module 0.42.1).
 */
export function paneOffers({
  favorites,
  prepares,
  effects,
  wildShape,
  creature,
  role,
  shaped,
}: Readonly<{
  favorites?: boolean
  prepares: boolean
  effects?: true
  wildShape?: true
  creature?: CreatureFacts
  role: SeatRole
  shaped: boolean
}>) {
  const player = !creature && role === 'player'
  return {
    favorites: favorites === true && !creature && !shaped,
    prepare: prepares && player && !shaped,
    effects: effects === true && player && !shaped,
    wildShape: wildShape === true && player,
  }
}
