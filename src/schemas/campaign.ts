import { z } from 'zod'
import {
  CAMPAIGN_TITLE_MAX_LENGTH,
  GAME_URL_EXAMPLE,
  JOIN_PATH,
  SECRET_MAX_LENGTH,
  SECRET_MIN_LENGTH,
} from '@/constants/campaign'

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

/** A campaign's title, which must match the title of the module's campaign in Foundry. */
export const campaignTitleSchema = z
  .string({ error: "Enter the campaign's title." })
  .trim()
  .min(1, "Enter the campaign's title.")
  .max(
    CAMPAIGN_TITLE_MAX_LENGTH,
    `Keep the title to ${CAMPAIGN_TITLE_MAX_LENGTH} characters or fewer.`,
  )

export const forgeGameUrlSchema = z
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
  })

/** The secret the Gamemaster's module sends with each event for the campaign. */
export const secretSchema = z
  .string({ error: 'Enter a secret.' })
  .trim()
  .min(
    SECRET_MIN_LENGTH,
    `Use a secret of at least ${SECRET_MIN_LENGTH} characters.`,
  )
  .max(
    SECRET_MAX_LENGTH,
    `Keep the secret to ${SECRET_MAX_LENGTH} characters or fewer.`,
  )

export const campaignSetupSchema = z.object({
  title: campaignTitleSchema,
  gameUrl: forgeGameUrlSchema,
  secret: secretSchema,
})

const INVITE_CODE = /^[\w-]{16}$/
const INVITE_LINK = new RegExp(
  String.raw`${JOIN_PATH}/([\w-]{16})/?(?:[?#].*)?$`,
)

/**
 * Read the code from an invite link a player pasted, or from the code alone.
 * @returns The code, or undefined if the value is neither.
 */
export function toInviteCode(value: string): string | undefined {
  const text = value.trim()
  if (INVITE_CODE.test(text)) return text
  return INVITE_LINK.exec(text)?.[1]
}
