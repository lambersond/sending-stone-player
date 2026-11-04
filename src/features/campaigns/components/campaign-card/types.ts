import type { OwnedCampaign, SecretFormState } from '@/types/campaign'

export type CampaignCardProps = {
  campaign: OwnedCampaign
  inviteUrl: string
  changeSecret: (
    state: SecretFormState,
    formData: FormData,
  ) => Promise<SecretFormState>
  resetInvite: () => Promise<void>
  /** Remove the player's character with this id from the campaign. */
  removePlayer: (characterId: string) => Promise<void>
  /**
   * Revoke the link from its player's Magical Recipe Book to the character with this id, from
   * module 0.38.0. Without it, the card offers no revoke.
   */
  revokeCookbookLink?: (characterId: string) => Promise<void>
  /** Clear the campaign's chat in the app, for every player (v0.44). */
  clearChat: () => Promise<void>
  remove: () => Promise<void>
}
