/**
 * The Magical Recipe Book's body, version 1, as its server builds it (its
 * src/server/sending-stone/types.ts).
 */
export type CookbookDishBody = {
  version: 1
  dish: {
    id: string
    recipe: string
    /** How it was cooked, as the cookbook stored it: kept, never acted on. */
    status: string
    outcome: 'boon' | 'bane' | 'standard'
    cookedOnDay: number
    consumedOnDay: number | null
  }
  cook: { name: string }
  message: string
  effect: null | {
    name: string
    ingredients: { name: string; text: string }[]
    duration: { seconds: number }
    stacks: false
    changes: CookbookChange[]
  }
}

/**
 * One of a dish's changes: a kind this app knows, by its own keys alone, or another kept as sent.
 */
export type CookbookChange =
  | { type: 'abilityScore'; ability: string; value: number }
  | {
      type: 'rollMode'
      roll: 'check' | 'save'
      ability: string
      mode: 'advantage' | 'disadvantage'
    }
  | {
      type: 'rollMode'
      roll: 'skill'
      skill: string
      mode: 'advantage' | 'disadvantage'
    }
  | {
      type: 'rollBonus'
      roll: 'attack' | 'damage' | 'check' | 'save'
      value: number
    }
  | { type: 'maxHitPoints'; value: number; formula?: string }
  | { type: 'damageResistance' | 'damageVulnerability'; damageType: string }
  | { type: 'conditionImmunity'; condition: string }
  | { type: 'sense'; sense: string; range: number }
  | { type: 'exhaustion'; levels: number }
  | { type: string; [key: string]: unknown }

/** A dish as the module fetches it, from module 0.38.0. */
export type DishCommand = {
  id: string
  actorId: string
  kind: 'dish'
  dish: { queuedAt: number; body: CookbookDishBody }
  mode: 0
  explicit: false
  extras: []
  dice: []
}

/** What became of a dish, as the player's card shows it. */
export type CookbookDishView = {
  id: string
  recipe: string
  outcome: 'boon' | 'bane' | 'standard'
  state: 'queued' | 'claimed' | 'delivered' | 'applied' | 'dismissed' | 'failed'
  reason: string | null
  /** The names in `appliedTo`, in order: none until the Gamemaster's choice is heard of. */
  eatenBy: string[]
  rolled: { type: string; value: number; formula?: string }[]
  queuedAt: string
  decidedAt: string | null
}

/** The player's Magical Recipe Book card, polled (`GET /api/characters/[id]/cookbook`). */
export type CookbookView = {
  /** A short hash of the rest: unchanged means nothing new. */
  version: string
  /** Whether the campaign takes dishes now: Campaign.dishesEnabled. */
  enabled: boolean
  /** Whether the Gamemaster's game is sending, as `isLive` says. */
  live: boolean
  link: { hint: string; createdAt: string; lastUsedAt: string | null } | null
  dishes: CookbookDishView[]
}

/** A new link code, shown once, or why none was made. */
export type CookbookCodeAnswer = { code: string } | { message: string }

/**
 * Where a player's Magical Recipe Book card is drawn: their own seat's character, and its actions.
 */
export type CookbookPlace = {
  characterId: string
  /** Whether it's in view, and so polled: the journal's flag. */
  active: boolean
  make: () => Promise<CookbookCodeAnswer>
  revoke: () => Promise<void>
}
