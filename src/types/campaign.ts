import type { FoundrySnapshot } from '@/types/foundry-settings'

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
  /** The latest post from Foundry refused for it in the last day, which its card explains. */
  refusal?: CampaignRefusal
  /**
   * What Foundry last said of itself for it: its versions, and from module 0.30.0 its settings and
   * what players see in chat. Unset until a hello is applied.
   */
  foundry?: FoundrySnapshot
  /**
   * Whether players' rolls are made in the game, with the dice they roll here: turned on in
   * Foundry, whether the game is fetching them now, whether their attacks, and their spells and
   * features, are made there too, and whether they're asked here for the saves the game asks of
   * their characters, as the game last said.
   */
  rolls: {
    enabled: boolean
    reaching: boolean
    attacks: boolean
    spells: boolean
    prompts: boolean
  }
  /**
   * Whether players move items and coins from here, from module 0.31.0, apart from the rolls:
   * turned on in Foundry, and whether the game is fetching moves now.
   */
  transfers: { enabled: boolean; reaching: boolean }
  /**
   * Dishes from the Magical Recipe Book, from module 0.38.0: whether the game takes them, and how
   * many wait for Foundry or wait in it for the Gamemaster. None reads as off.
   */
  dishes?: { enabled: boolean; waiting: number; inFoundry: number }
  /**
   * Whether the campaign lets its players turn off, turn on and delete their own characters'
   * effects from here, from module 0.39.0, as its last hello said. None reads as off.
   */
  effects?: { enabled: boolean }
  /**
   * Each with who plays it, and their character's id, once a player has chosen it; and from module
   * 0.36.0 its companions, as the module lists them, by name and kind, a summoned one with the
   * item it was summoned with: none for none. The app always gives them; optional so that a card
   * given none, as one from before module 0.36.0, still draws.
   */
  characters: {
    id: string
    name: string
    player?: string
    characterId?: string
    companions?: { name: string; kind: 'owned' | 'summoned'; from?: string }[]
    /** Whether its player's Magical Recipe Book is linked to it, from module 0.38.0. */
    cookbookLinked?: boolean
  }[]
  /**
   * Its Group actors, such as its party, from module 0.30.0: whether each is dnd5e's primary
   * party, and whether any of its players may see it in Foundry.
   */
  groups: { id: string; name: string; primary: boolean; shared: boolean }[]
}

/**
 * A post from Foundry refused for a campaign, as its card explains it: the wrong secret, a title no
 * campaign here has (`detail`, the title Foundry sent, on each of the game's campaigns waiting for
 * it), or what couldn't be read (`detail`, the event's type and what was wrong).
 */
export type CampaignRefusal = {
  reason: 'wrongSecret' | 'notSetUp' | 'malformed'
  /** The status it was refused with. */
  status: number
  detail?: string
  /** When, as an ISO date. */
  at: string
  /** Has Foundry not reached the app since? */
  current: boolean
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
  /**
   * The campaign just set up, with its secret to copy: it is not kept, so not shown again; and its
   * id, which the page chooses once Done is pressed.
   */
  saved?: { id: string; title: string; secret: string }
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
