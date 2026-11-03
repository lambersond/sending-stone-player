/**
 * Where this device keeps whether damage on its own spends what its use would, after the seat and
 * the character's pane (module 0.41.0): on the first time, then as the player last left it there.
 */
export const ALONE_SPEND_KEY = 'sending-stone:alone-spend'

/** What the Spend switch of damage on its own is: on or off. */
export const SPEND_CHOICES = ['on', 'off'] as const

/**
 * Whose side a combatant is on, as a pill beside their name: the player's own row, an ally, or a
 * creature the game has as neutral. Never an enemy, as a hostile token may be only the game's
 * default.
 */
export const PILLS = {
  you: { label: 'You', look: 'bg-primary/10 text-primary-text' },
  ally: { label: 'Ally', look: 'bg-party/15 text-party' },
  neutral: {
    label: 'Neutral',
    look: 'bg-text-secondary/10 text-text-secondary',
  },
} as const
