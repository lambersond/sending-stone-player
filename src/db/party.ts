import prisma from '@/clients/prisma'
import { FOUNDRY_ID } from '@/db/constants'
import { isLive } from '@/utils/live'
import {
  canSee,
  characterEnds,
  distributeAmong,
  partySheetView,
  partyTooLarge,
  sendParties,
  tableGroup,
  takesFromParty,
} from '@/utils/party'
import { characterRoster, groupRoster } from '@/utils/roster'
import type { SheetSeat } from '@/types/character'
import type { AllowedGroup, PartySeat, PartyView } from '@/types/party'
import type { SheetInventory, GroupSheet } from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// Who may see a campaign's party sheets (module 0.30.0), as Foundry shows them: a player whose
// Foundry user has Observer or Owner on the group, through their character in the campaign; and the
// campaign's Gamemaster, through the campaign they own. Every read is checked here, each time, so
// that a player whose access is taken away in Foundry loses it here at once. Anyone else is told
// nothing: a group that isn't there, a campaign that isn't theirs and no access all look the same.

/** A seat at a character's sheet, at its party sheets: the same player, or the same Gamemaster. */
export function partySeat(seat: SheetSeat): PartySeat {
  if (seat.role === 'gm') {
    return {
      role: 'gm',
      campaignId: seat.campaignId ?? '',
      userId: seat.userId,
    }
  }
  return {
    role: 'player',
    campaignId: seat.campaignId,
    actorId: seat.actorId,
    characterId: seat.characterId ?? '',
    name: seat.name,
  }
}

/** What the check reads of a campaign: never anything only its Gamemaster may read. */
const campaignSelect = {
  id: true,
  title: true,
  origin: true,
  version: true,
  lastSeenAt: true,
  ownerId: true,
  groups: true,
  transfersEnabled: true,
  transferFeatures: true,
  bridgePolledAt: true,
} as const

/** The campaign and the group's entry, where the seat may see the group; else undefined. */
async function access(seat: PartySeat, groupId: string) {
  if (!FOUNDRY_ID.test(groupId) || !seat.campaignId) return
  const campaign = await prisma.campaign.findUnique({
    where: { id: seat.campaignId },
    select: campaignSelect,
  })
  if (!campaign) return
  const entry = groupRoster(campaign.groups).find(({ id }) => id === groupId)
  if (!entry) return
  const allowed =
    seat.role === 'gm'
      ? !!seat.userId && campaign.ownerId === seat.userId
      : canSee(entry, seat.actorId)
  return allowed ? { campaign, entry } : undefined
}

/**
 * The group, where the seat may see it now, for its descriptions to be served by.
 * @returns Undefined where it may not, or the group isn't there.
 */
export async function allowedGroup(
  seat: PartySeat,
  groupId: string,
): Promise<AllowedGroup | undefined> {
  const found = await access(seat, groupId)
  return found && { campaignId: found.campaign.id, groupId: found.entry.id }
}

/**
 * A party's journal of notes as the seat may reach it now, from module 0.34.0: whether no campaign
 * character may see the party in Foundry, which only the Gamemaster is ever told, as only they may
 * open it then; and who a player writes as, their character, or no one for the Gamemaster. Checked
 * on every request, as the sheet is, so a player whose access was taken away reaches nothing.
 * @returns Undefined where the seat may not see the party, or it isn't there.
 */
export async function partyNotesAccess(
  seat: PartySeat,
  groupId: string,
): Promise<
  | {
      campaignId: string
      groupId: string
      private: boolean
      writer: string | null
    }
  | undefined
> {
  const found = await access(seat, groupId)
  if (!found) return undefined
  return {
    campaignId: found.campaign.id,
    groupId: found.entry.id,
    private: Object.keys(found.entry.access ?? {}).length === 0,
    writer: seat.role === 'player' ? seat.actorId : null,
  }
}

/**
 * Whether anything is new on a party sheet the seat may see now: the campaign's version, whether
 * its game is live, and from module 0.31.0 whether the seat may take from it, which its game's
 * taking moves or not changes with no new version. Checked before anything is said to be
 * unchanged, so a player whose access was taken away is told nothing, rather than that nothing
 * changed.
 * @returns Undefined where the seat may not see it.
 */
export async function getPartyStatus(
  seat: PartySeat,
  groupId: string,
): Promise<{ version: number; live: boolean; moves: boolean } | undefined> {
  const found = await access(seat, groupId)
  return (
    found && {
      version: found.campaign.version,
      live: isLive(found.campaign.lastSeenAt),
      moves: takesFromParty(seat, found.campaign, found.entry),
    }
  )
}

/**
 * A party sheet as the seat may see it: its members by name and portrait only, the player's own
 * character marked, its stash and its description; or, without a sheet, why there's none.
 * @param seat - Who is at it, already resolved for the signed-in user.
 * @param groupId - The group's actor id.
 * @param known - What the viewer already has: the sheet of this version is left out.
 * @returns Undefined where the seat may not see it, or it isn't there.
 */
export async function getGroupView(
  seat: PartySeat,
  groupId: string,
  known: { sheetVersion?: string } = {},
): Promise<PartyView | undefined> {
  const found = await access(seat, groupId)
  if (!found) return undefined
  const { campaign, entry } = found
  const held = await prisma.groupSheet.findUnique({
    where: { campaignGroup: { campaignId: campaign.id, actorId: entry.id } },
    select: { data: true, updatedAt: true },
  })
  const sheetVersion = held?.updatedAt.toISOString()
  const withheld = entry.sheetWithheld
  const moves = await partyMoves(seat, found, held)
  return {
    version: campaign.version,
    live: isLive(campaign.lastSeenAt),
    campaign: { title: campaign.title },
    group: tableGroup(entry, campaign.origin),
    ...(held &&
      sheetVersion !== known.sheetVersion && {
        sheet: partySheetView(
          held.data as unknown as GroupSheet,
          seat,
          campaign.origin,
        ),
      }),
    ...(sheetVersion && { sheetVersion }),
    ...(withheld?.reason === 'tooLarge' && {
      withheld: partyTooLarge(withheld),
    }),
    // Only the Gamemaster is told of a group no player may see, as only they may open it.
    ...(seat.role === 'gm' &&
      Object.keys(entry.access ?? {}).length === 0 && {
        private: true as const,
      }),
    ...(moves && { moves }),
  }
}

/**
 * Where the seat may move a party's things, where it may: who the Gamemaster may take into, from
 * module 0.31.0, any of the campaign's characters, which only their view reads; from module
 * 0.32.0, who the party's things may be sent to, any of them too, and those its coin is shared
 * among; and a player's character's coins, which they may give the party.
 */
async function partyMoves(
  seat: PartySeat,
  { campaign, entry }: NonNullable<Awaited<ReturnType<typeof access>>>,
  held: { data: Prisma.JsonValue } | null,
) {
  if (!takesFromParty(seat, campaign, entry)) return
  const sends = campaign.transferFeatures.includes('partySends')
  const shares = campaign.transferFeatures.includes('distribute')
  const ownActor = seat.role === 'player' ? seat.actorId : undefined
  const [roster, ownSheet] = await Promise.all([
    seat.role === 'gm' || sends
      ? prisma.campaign.findUnique({
          where: { id: campaign.id },
          select: { characters: true },
        })
      : undefined,
    ownActor
      ? prisma.actorSheet.findUnique({
          where: {
            campaignActor: { campaignId: campaign.id, actorId: ownActor },
          },
          select: { data: true },
        })
      : undefined,
  ])
  const characters =
    roster && characterEnds(characterRoster(roster.characters), campaign.origin)
  const among =
    shares && held
      ? distributeAmong(held.data as unknown as GroupSheet, campaign.origin)
      : undefined
  const coins = (
    ownSheet?.data as unknown as { inventory?: SheetInventory } | null
  )?.inventory?.currency
  return {
    ...(seat.role === 'gm' && characters && { characters }),
    ...(sends &&
      characters && {
        send: {
          parties: sendParties(seat, campaign.groups, entry, campaign.origin),
          characters,
        },
      }),
    ...(among && { distribute: among }),
    ...(coins && { give: { currency: coins } }),
  }
}
