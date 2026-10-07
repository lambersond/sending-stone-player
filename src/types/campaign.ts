/** A campaign as its Gamemaster sees it on their campaigns page. */
export type OwnedCampaign = {
  id: string
  title: string
  gameUrl: string
  worldTitle?: string
  inviteCode: string
  /** Has the module's campaign sent anything yet? */
  connected: boolean
  /** Has it sent its characters? Unset until a bridge.hello is applied. */
  rosterReceived: boolean
  /** Is the Gamemaster's game sending right now? */
  live: boolean
  lastSeenAt?: string
  /**
   * Whether players' rolls are made in the game, with the dice they roll here: turned on in
   * Foundry, whether the game is fetching them now, and whether their attacks, and their spells
   * and features, are made there too, as the game last said.
   */
  rolls: {
    enabled: boolean
    reaching: boolean
    attacks: boolean
    spells: boolean
  }
  /** Each with who plays it, and their character's id, once a player has chosen it. */
  characters: {
    id: string
    name: string
    player?: string
    characterId?: string
  }[]
}

/** One of a campaign's characters, as offered to a player choosing theirs. */
export type CharacterOption = {
  id: string
  name: string
  /** Already chosen: by this player, or by someone else. */
  claimedBy?: 'you' | 'someone'
  /** This player's character, when it is theirs. */
  characterId?: string
}

/** A campaign a player can choose a character in. */
export type CampaignChoice = {
  id: string
  title: string
  worldTitle?: string
  gameUrl: string
  gamemaster?: string
  characters: CharacterOption[]
}

export type CampaignSetupInput = {
  title: string
  gameUrl: string
  secret: string
}

export type CampaignSetupFormState = {
  values?: CampaignSetupInput
  errors?: Partial<Record<keyof CampaignSetupInput, string[]>>
  message?: string
  /** The campaign just set up, with its secret to copy: it is not kept, so not shown again. */
  saved?: { title: string; secret: string }
}

export type SecretFormState = {
  error?: string
  saved?: boolean
}

export type ChooseCharacterFormState = {
  message?: string
}

export type InviteFormState = {
  value?: string
  error?: string
}
