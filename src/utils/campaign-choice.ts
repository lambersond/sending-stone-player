import type { CampaignChoice } from '@/types/campaign'
import type { ConnectedCharacter } from '@/types/sending-stone'

/**
 * A campaign's characters, as offered to a player choosing one.
 * @param userId - The player.
 * @param exceptCharacterId - A character of theirs choosing again, whose own choice is not a claim.
 */
export function toChoice(
  campaign: {
    id: string
    title: string
    worldTitle: string | null
    origin: string
    characters: unknown
    owner: { name: string } | null
    players: { id: string; actorId: string | null; userId: string }[]
  },
  userId: string,
  exceptCharacterId?: string,
): CampaignChoice {
  const claims = new Map(
    campaign.players
      .filter(({ id, actorId }) => actorId && id !== exceptCharacterId)
      .map(player => [player.actorId, player]),
  )
  return {
    id: campaign.id,
    title: campaign.title,
    worldTitle: campaign.worldTitle ?? undefined,
    gameUrl: campaign.origin,
    gamemaster: campaign.owner?.name,
    characters: (campaign.characters as ConnectedCharacter[]).map(
      ({ id, name }) => {
        const claim = claims.get(id)
        if (!claim) return { id, name }
        return claim.userId === userId
          ? { id, name, claimedBy: 'you', characterId: claim.id }
          : { id, name, claimedBy: 'someone' }
      },
    ),
  }
}
