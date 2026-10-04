import { z } from 'zod'
import {
  CAMPAIGN_TITLE_MAX_LENGTH,
  GAME_URL_EXAMPLE,
  NAME_MAX_LENGTH,
} from '@/constants/character'

// A Forge game is served from its own subdomain, such as my-game.forge-vtt.com.
const FORGE_GAME_HOST = /^(?!www\.)[a-z\d-]+\.forge-vtt\.com$/
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i

/**
 * Reduce an address pasted from The Forge to the game's origin.
 *
 * Sending Stone posts from the Gamemaster's browser, so a game's events arrive with its origin as
 * their `Origin`. Any page of the game (`/game`, `/join`, …) names the same origin.
 * @param value - The address as entered. The scheme may be left off.
 * @returns The game's origin, or undefined if the address is not a Forge game.
 */
export function toForgeGameUrl(value: string): string | undefined {
  const address = HAS_SCHEME.test(value) ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return undefined
  }
  if (!['http:', 'https:'].includes(url.protocol)) return undefined
  if (url.port || url.username || url.password) return undefined
  if (!FORGE_GAME_HOST.test(url.hostname)) return undefined
  return `https://${url.hostname}`
}

/** The title the Gamemaster gave the campaign in Sending Stone, which links a character to it. */
export const campaignTitleSchema = z
  .string({ error: "Enter the campaign's title." })
  .trim()
  .min(1, "Enter the campaign's title.")
  .max(
    CAMPAIGN_TITLE_MAX_LENGTH,
    `Keep the title to ${CAMPAIGN_TITLE_MAX_LENGTH} characters or fewer.`,
  )

export const characterSchema = z.object({
  name: z
    .string({ error: 'Give your character a name.' })
    .trim()
    .min(1, 'Give your character a name.')
    .max(
      NAME_MAX_LENGTH,
      `Keep the name to ${NAME_MAX_LENGTH} characters or fewer.`,
    ),
  campaignTitle: campaignTitleSchema,
  gameUrl: z
    .string({ error: "Enter your game's Forge address." })
    .trim()
    .min(1, "Enter your game's Forge address.")
    .transform((value, context) => {
      const gameUrl = toForgeGameUrl(value)
      if (!gameUrl) {
        context.addIssue({
          code: 'custom',
          message: `Use your game's Forge address, like ${GAME_URL_EXAMPLE}.`,
        })
        return z.NEVER
      }
      return gameUrl
    }),
})
