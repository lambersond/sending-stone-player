/**
 * What the module says, from 0.30.0, of the Foundry settings that decide what it sends for a
 * campaign, for its Gamemaster to check (format 1): the other modules it works with, the settings
 * by section, each as Foundry labels it and in the Gamemaster's language, and what players see in
 * chat as those settings stand. Never a secret, an address or a token: the module sends only the
 * settings it lists.
 */
export type FoundrySettings = {
  format: 1
  modules: {
    id: string
    title: string
    version: string | null
    active: boolean
  }[]
  sections: {
    id: string
    title: string
    rows: {
      id: string
      label: string
      value: boolean | string | number | null
      text: string
      note?: string
    }[]
  }[]
  results: { id: string; state: 'shown' | 'partial' | 'hidden'; text: string }[]
}

/**
 * What Foundry last said of itself for a campaign: when, its versions, which every module's hello
 * carries, and from module 0.30.0 its settings. Read on the Gamemaster's campaign card only.
 */
export type FoundrySnapshot = {
  /** When the module sent it, by the game's clock. */
  receivedAt: string
  module?: { id: string; version: string | null }
  foundry?: { version: string; generation?: number | null }
  system?: { id: string; title: string; version: string }
  settings?: FoundrySettings
}
