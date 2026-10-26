import { MOST_SEATS_SHOWN } from '@/constants/campaign'
import { BRIDGE_TIMEOUT } from '@/constants/sending-stone'
import type { CampaignRefusal, OwnedCampaign } from '@/types/campaign'

// How the Gamemaster's campaigns page (v0.39) orders and sums up their campaigns: those that need
// them first, then those whose Foundry is live, then by when Foundry was last heard; what each
// row's flag says; and the players' seats it draws. Pure, so that the page sorts once, on the
// server, and every test can pin it.

/** What a campaign needs of its Gamemaster: Foundry's posts refused, or a first connection. */
export type Attention = 'refused' | 'waiting'

/**
 * What the campaign needs of its Gamemaster, if anything: a refusal Foundry hasn't got past since
 * (`refusal.current`), whatever its reason, before anything else, as a campaign waiting for its
 * first connection may have one too; else a first connection, while Foundry has never reached it.
 * A refusal shown muted as past needs nothing.
 */
export function attentionOf(
  campaign: Pick<OwnedCampaign, 'refusal' | 'connected'>,
): Attention | null {
  if (campaign.refusal?.current) return 'refused'
  if (!campaign.connected) return 'waiting'
  // eslint-disable-next-line unicorn/no-null -- needs nothing
  return null
}

const ATTENTION_RANK: Record<Attention, number> = { refused: 0, waiting: 1 }

/** Two times as a sort compares them: the newest first, and none, never heard, last. */
const newestFirst = (a: number | undefined, b: number | undefined) => {
  if (a === b) return 0
  if (a === undefined) return 1
  if (b === undefined) return -1
  return b - a
}

/**
 * The Gamemaster's campaigns in the page's order: first those that need them, refused then
 * waiting; then those whose Foundry is live, as of `now`; then by when Foundry was last heard,
 * newest first, never heard last. Ties keep the order given, the database's: by title, then when
 * each was set up.
 */
export function sortCampaigns<
  T extends Pick<OwnedCampaign, 'refusal' | 'connected' | 'lastSeenAt'>,
>(campaigns: readonly T[], now: number): T[] {
  const ranked = campaigns.map((campaign, index) => {
    const attention = attentionOf(campaign)
    const heard = campaign.lastSeenAt
      ? Date.parse(campaign.lastSeenAt)
      : undefined
    return {
      campaign,
      index,
      need: attention === null ? 2 : ATTENTION_RANK[attention],
      live: heard !== undefined && now - heard < BRIDGE_TIMEOUT ? 0 : 1,
      heard,
    }
  })
  return ranked
    .toSorted(
      (a, b) =>
        a.need - b.need ||
        a.live - b.live ||
        newestFirst(a.heard, b.heard) ||
        a.index - b.index,
    )
    .map(({ campaign }) => campaign)
}

/** The short words a row's flag has for a current refusal, by its reason. */
const REFUSED: Record<CampaignRefusal['reason'], string> = {
  wrongSecret: 'Foundry’s posts refused: wrong secret',
  notSetUp: 'Foundry’s posts refused: title doesn’t match',
  malformed: 'Foundry’s posts refused: couldn’t read them',
}

/**
 * What a campaign's row flags, where it needs its Gamemaster: a current refusal, in a few words
 * for its reason, or a first connection to make. None where it needs nothing.
 */
export function campaignFlag(
  campaign: Pick<OwnedCampaign, 'refusal' | 'connected'>,
): { attention: Attention; text: string } | undefined {
  const attention = attentionOf(campaign)
  if (attention === 'refused' && campaign.refusal) {
    return { attention, text: REFUSED[campaign.refusal.reason] }
  }
  if (attention === 'waiting') {
    return { attention, text: 'Connect Foundry to start' }
  }
  return undefined
}

/**
 * The letters a seat draws for its player: the first letter of each of the first two words of
 * their name, in capitals, as the design draws them; one for a name of one word.
 */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => [...word][0])
    .join('')
    .toUpperCase()
}

/** One of a campaign's characters as its row draws it: its player's letters, or none chosen yet. */
export type Seat = {
  character: string
  player?: string
  initials?: string
}

/**
 * The seats a campaign's row draws: its first five characters, each with its player's letters, or
 * none where no player has chosen it yet; how many of all its characters are chosen; and how many
 * it has. Companions aren't seats.
 */
export function seatsOf(campaign: Pick<OwnedCampaign, 'characters'>): {
  shown: Seat[]
  chosen: number
  total: number
} {
  const { characters } = campaign
  return {
    shown: characters
      .slice(0, MOST_SEATS_SHOWN)
      .map(({ name, player }) =>
        player === undefined
          ? { character: name }
          : { character: name, player, initials: initialsOf(player) },
      ),
    chosen: characters.filter(({ player }) => player !== undefined).length,
    total: characters.length,
  }
}
