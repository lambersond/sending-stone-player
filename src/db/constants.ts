/** A Foundry document's id as the module sends it, such as an actor's or a group's. */
export const FOUNDRY_ID = /^[\dA-Za-z]{1,64}$/

/**
 * How often the module's fetch may prune a campaign's spent rows as it claims, per server process,
 * in milliseconds: its dishes past their keeping, and its notes' made changes and orders past their
 * hour.
 */
export const PRUNE_EVERY = 10 * 60 * 1000
