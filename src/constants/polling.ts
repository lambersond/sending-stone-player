/** How often to ask for news, in milliseconds. */
export const POLL_INTERVAL = 3000

/** The longest wait between attempts while the server cannot be reached. */
export const POLL_MOST_DELAY = 30_000

/**
 * As a roll the game answered ends (ROADMAP item 39), how long a view's next read waits after the
 * one it then makes, in milliseconds: past the moment the game sends the sheet the roll changed,
 * which comes a moment after the roll's own answer, once its changes settle (the module waits
 * 250 ms for them), and short, so a Recharge chip goes soon after the tray's "recharged".
 */
export const READ_AGAIN_AFTER = 500
