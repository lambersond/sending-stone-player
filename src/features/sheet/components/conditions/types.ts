/** Opens the conditions panel, at a condition by its id, or at the top. */
export type ShowConditions = (id?: string) => void

/** One of a condition's rules, such as Blinded's "Can’t See". */
type ConditionRule = { title: string; text: string }

/** A condition and its rules. Its id is dnd5e's, as the sheet's conditions are. */
export type ConditionRules = {
  id: string
  name: string
  rules: ConditionRule[]
}
