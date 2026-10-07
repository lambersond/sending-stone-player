// What the routes the Gamemaster's module calls share. The module calls them from the Gamemaster's
// browser, on the game's page, not from the Foundry server, so they answer CORS like any
// cross-origin API.

/** CORS headers for a request from the module. */
export function cors(request: Request): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Origin': request.headers.get('origin') ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  })
  // Chromium asks before a public page, such as a Forge game, may reach a private address,
  // such as this listener running on localhost.
  if (
    request.headers.get('access-control-request-private-network') === 'true'
  ) {
    headers.set('Access-Control-Allow-Private-Network', 'true')
  }
  return headers
}

/** Run a database step, logging a failure, for the caller to answer with a retryable 500. */
export async function attempt<T>(
  step: () => Promise<T>,
  failure: string,
): Promise<T | undefined> {
  try {
    return await step()
  } catch (error) {
    console.error(failure, error)
    return undefined
  }
}

/** Why a request for a game's campaign is refused: none is set up for it here. */
export const notSetUp = (origin: string, title?: string) =>
  title
    ? `No campaign titled “${title}” is set up for ${origin} in Sending Stone`
    : `No campaign is set up for ${origin} in Sending Stone`
