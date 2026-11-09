import { companionRoster } from '@/utils/companions'
import type { SheetSeat } from '@/types/character'
import type { NoteBookKind } from '@/types/notes'
import type {
  CompanionEntry,
  ConnectedCharacter,
  GroupEntry,
} from '@/types/sending-stone'

// Who a campaign's rosters list, as its module last sent them: its characters, from its hello; its
// groups, from module 0.30.0; and its characters' companions, from module 0.36.0.

/** Whether a character is in the campaign's roster, as its module last listed it. */
function inRoster(characters: unknown, actorId: string): boolean {
  const roster = Array.isArray(characters)
    ? (characters as unknown as { id: string }[])
    : []
  return roster.some(({ id }) => id === actorId)
}

/**
 * Whether the seat's actor is listed now: its character in the campaign's roster; or at a
 * companion's seat (module 0.44.0), the companion by its key, as its character's still.
 */
export function seatListed(
  seat: Pick<SheetSeat, 'actorId' | 'companion'>,
  campaign: { characters: unknown; companions?: unknown },
): boolean {
  const { actorId, companion } = seat
  if (!actorId) return false
  if (!companion) return inRoster(campaign.characters, actorId)
  return companionRoster(campaign.companions).some(
    entry => entry.key === actorId && entry.of.includes(companion.of),
  )
}

/** The companion a seat is at, as the campaign lists it now, while it's still its character's. */
export function listedCompanion(
  seat: Pick<SheetSeat, 'actorId' | 'companion'>,
  companions: unknown,
): CompanionEntry | undefined {
  const of = seat.companion?.of
  return of
    ? companionRoster(companions).find(
        entry => entry.key === seat.actorId && entry.of.includes(of),
      )
    : undefined
}

/** A campaign's groups, as its roster keeps them: none where there's nothing to read. */
export function groupRoster(groups: unknown): GroupEntry[] {
  return Array.isArray(groups)
    ? (groups as (GroupEntry | null)[]).filter(
        (entry): entry is GroupEntry => typeof entry?.id === 'string',
      )
    : []
}

/** A campaign's characters, as its hello listed them: none where there's nothing to read. */
export function characterRoster(
  characters: unknown,
): Pick<ConnectedCharacter, 'id' | 'name' | 'img'>[] {
  return Array.isArray(characters)
    ? (characters as (ConnectedCharacter | null)[]).filter(
        (entry): entry is ConnectedCharacter => typeof entry?.id === 'string',
      )
    : []
}

/** Whether the campaign has a book's actor: a character, or a group, as its roster lists them. */
export function listedIn(
  campaign: { characters: unknown; groups: unknown },
  book: { kind: NoteBookKind; actorId: string },
): boolean {
  const roster =
    book.kind === 'personal' ? campaign.characters : campaign.groups
  return (
    Array.isArray(roster) &&
    (roster as ({ id?: unknown } | null)[]).some(
      entry => entry?.id === book.actorId,
    )
  )
}
