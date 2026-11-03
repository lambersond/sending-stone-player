import type { DescriptionOrigin } from '../description-actions/types'

/** What a description from the sheet is: whose, its hash, and where it's from. */
export type SheetTextProps = {
  characterId: string
  hash: string
  /** Where it's from, as what's rolled from it is named. */
  origin: DescriptionOrigin
}
