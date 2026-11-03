/*
 * The paths of a seat's pages and APIs, each id encoded as a path segment: the Gamemaster's at a
 * campaign's character and at a party sheet, and a character's player's at a party sheet. A seat's
 * API is `/api` and its page's path.
 */

/** The Gamemaster's page at a campaign's character: `/campaigns/<id>/characters/<actor>`. */
export function gmCharacterPath(campaignId: string, actorId: string): string {
  return `/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(actorId)}`
}

/** The Gamemaster's seat at a campaign's character, which a pick is taken through. */
export function gmCharacterApi(campaignId: string, actorId: string): string {
  return `/api${gmCharacterPath(campaignId, actorId)}`
}

/** A party sheet's page as the Gamemaster's: `/campaigns/<id>/party/<group>`. */
export function gmPartyPath(campaignId: string, groupId: string): string {
  return `/campaigns/${encodeURIComponent(campaignId)}/party/${encodeURIComponent(groupId)}`
}

/** A party sheet's API as the Gamemaster's. */
export function gmPartyApi(campaignId: string, groupId: string): string {
  return `/api${gmPartyPath(campaignId, groupId)}`
}

/** A character's page: `/characters/<id>`. */
export function characterPath(characterId: string): string {
  return `/characters/${encodeURIComponent(characterId)}`
}

/** A party sheet's page as a character's player sees it: `/characters/<id>/party/<group>`. */
export function partyPath(characterId: string, groupId: string): string {
  return `${characterPath(characterId)}/party/${encodeURIComponent(groupId)}`
}

/** A party sheet's API as a character's player's. */
export function partyApi(characterId: string, groupId: string): string {
  return `/api${partyPath(characterId, groupId)}`
}
