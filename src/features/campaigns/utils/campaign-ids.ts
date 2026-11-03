// The ids the campaigns page (round 0.39.0) moves focus to by, shared by the index, its head and
// a campaign's page, which the server draws.

/** The page's own heading, Your campaigns, which takes focus once a campaign is deleted. */
export const PAGE_HEADING_ID = 'your-campaigns'

/** A campaign's heading on its page, which names its `article` and takes focus as it opens. */
export const campaignHeadingId = (campaignId: string) =>
  `campaign-${campaignId}`

/**
 * A character's link to its sheet on its campaign's page, which takes focus once its player is
 * removed.
 */
export const sheetLinkId = (campaignId: string, characterId: string) =>
  `campaign-${campaignId}-sheet-${characterId}`

/** The element with this id, if it's there: by the id itself, which a selector would escape. */
export const byId = (id: string) =>
  // eslint-disable-next-line unicorn/prefer-query-selector -- an id, not a selector
  document.getElementById(id) ?? undefined
