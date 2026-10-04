export type Character = {
  id: string
  name: string
  gameUrl: string
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
