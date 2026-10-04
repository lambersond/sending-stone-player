export type Character = {
  id: string
  name: string
  gameUrl: string
  /** The title of the campaign the character is in. Empty for one made before campaigns. */
  campaignTitle: string
}

export type CharacterInput = Omit<Character, 'id'>

export type CharacterFormState = {
  /** What was submitted, so a rejected form can be shown again as it was. */
  values?: CharacterInput
  /** Problems with individual fields, by field name. */
  errors?: Partial<Record<keyof CharacterInput, string[]>>
  /** A problem that is not about any one field. */
  message?: string
}

export type CampaignTitleFormState = {
  /** What was submitted, so a rejected title can be shown again. */
  value?: string
  error?: string
}
