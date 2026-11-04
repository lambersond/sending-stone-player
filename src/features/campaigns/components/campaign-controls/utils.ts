import { byId, sheetLinkId } from '../../utils/campaign-ids'

/**
 * Has focus go to a character's sheet link once its row is drawn again without the control
 * pressed, gone with what it acted on.
 */
export const toSheetLink = (campaignId: string, actorId: string) => () =>
  byId(sheetLinkId(campaignId, actorId))
