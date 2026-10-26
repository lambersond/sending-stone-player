export const CAMPAIGN_TITLE_MAX_LENGTH = 100

export const CAMPAIGN_TITLE_EXAMPLE = 'Curse of Strahd'

export const GAME_URL_EXAMPLE = 'https://my-game.forge-vtt.com'

export const SECRET_MIN_LENGTH = 12

export const SECRET_MAX_LENGTH = 200

/** Where a player follows a campaign's invite link: `/join/<code>`. */
export const JOIN_PATH = '/join'

/** The Gamemaster's campaigns page. A campaign chosen on it is in its address, `?campaign=<id>`. */
export const CAMPAIGNS_PATH = '/campaigns'

/**
 * The shape of a campaign's id as the campaigns page reads it from its address: any other value of
 * `?campaign=` is ignored, and never carried through sign-in.
 */
export const CAMPAIGN_ID = /^[\w-]{1,64}$/

/** From how many campaigns the campaigns page offers a search of them. */
export const CAMPAIGN_SEARCH_FROM = 7

/** The most players' seats a campaign's row shows, as two letters each. */
export const MOST_SEATS_SHOWN = 5
