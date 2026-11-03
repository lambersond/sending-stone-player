import { currentCombatant } from './combat'
import { classLine } from '@/features/sheet/utils/class-line'
import { megabytes } from '@/utils/format-amount'
import { gameHost } from '@/utils/game-host'
import { headerLineOf } from '@/utils/wild-shape-words'
import type { LiveState } from '@/components/live-status/types'
import type { Tab } from '@/features/table/types'
import type { Character } from '@/types/character'
import type { GmRolls, TableCombat, TableView } from '@/types/table'

/** The header's line under the character's name: what is happening in the tab shown. */
export function subtitle(
  tab: Tab,
  view: TableView,
  character: Character,
): string {
  if (!view.campaign) return campaignAndGame(view, character)
  if (tab === 'character') return sheetSummary(view)
  if (tab === 'chat') {
    return `${view.campaign.title} · ${messageCount(view.messages.length)}`
  }
  return combatSummary(view.combat)
}

/** The campaign, as its Gamemaster now titles it, and the game it is played in. */
export function campaignAndGame(view: TableView, character: Character): string {
  const host = gameHost(character.gameUrl)
  const title = view.campaign?.title ?? character.campaignTitle
  return title ? `${title} · ${host}` : host
}

/** Such as "Fighter 5 · Champion", or the campaign's title until the sheet arrives. */
function sheetSummary(view: TableView): string {
  if (view.sheet) return headerLine(view.sheet)
  return view.campaign?.title ?? 'No sheet yet'
}

/**
 * The header's line about the character: its classes, or from module 0.40.0, while it's
 * transformed, what into, "In Wild Shape · Wolf".
 */
export function headerLine(sheet: NonNullable<TableView['sheet']>): string {
  return sheet.form ? headerLineOf(sheet.form) : classLine(sheet)
}

export function messageCount(count: number): string {
  return `${count} ${count === 1 ? 'message' : 'messages'}`
}

export function combatSummary(combat?: TableCombat): string {
  if (!combat) return 'No combat'
  if (!combat.started) return 'Getting ready'
  const current = currentCombatant(combat)
  if (current?.side === 'me') return `Round ${combat.round} · Your turn`
  return current
    ? `Round ${combat.round} · ${current.name}’s turn`
    : `Round ${combat.round}`
}

/** An unread count as a badge shows it. */
export function badgeCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

export function liveState(
  playing: boolean,
  view: TableView,
  connection: 'live' | 'reconnecting',
): LiveState {
  if (!playing) return 'waiting'
  if (connection === 'reconnecting') return 'reconnecting'
  return view.live ? 'live' : 'offline'
}

/**
 * Tells the Gamemaster at one of their campaign's characters' sheets (#156) where what they roll
 * there goes: made in their game as the character's, marked as theirs; kept here until their
 * module is new enough to mark it; or kept here while their game takes no rolls.
 */
export function gmNote(name: string, rolls: GmRolls): string {
  const at = `You're at ${name}'s sheet as the Gamemaster.`
  let note = `${at} What you roll here is made in your game as ${name}'s, marked as yours.`
  if (rolls === 'update') {
    note = `${at} Your rolls stay here: update Sending Stone in Foundry to 0.23.0 to make them in your game as ${name}'s.`
  } else if (rolls === 'off') {
    note = `${at} Your rolls stay here while your game isn't taking rolls from Sending Stone.`
  }
  return note
}

/** How large a sheet held back for its size came to, against what this app takes, where known. */
export function tooLargeLine(
  withheld: NonNullable<TableView['sheetWithheld']>,
): string | undefined {
  const { bytes, limit } = withheld
  return typeof bytes === 'number' && typeof limit === 'number'
    ? `It came to ${megabytes(bytes, Math.ceil)}, more than the ${megabytes(limit, Math.floor)} this app takes. `
    : undefined
}
