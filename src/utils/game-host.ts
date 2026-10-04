/**
 * The host of a game URL, such as my-game.forge-vtt.com, for display.
 * @param gameUrl - A stored game URL.
 * @returns The host, or the URL unchanged if it cannot be parsed.
 */
export function gameHost(gameUrl: string): string {
  try {
    return new URL(gameUrl).host
  } catch {
    return gameUrl
  }
}
