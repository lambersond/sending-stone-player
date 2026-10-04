import { headers } from 'next/headers'

/**
 * The origin this app is being served from, as the browser sees it, such as
 * https://sending-stone.example.com. Behind a proxy, from the forwarded headers it sets.
 */
export async function appOrigin(): Promise<string> {
  const request = await headers()
  const host = request.get('x-forwarded-host') ?? request.get('host')
  const protocol =
    request.get('x-forwarded-proto')?.split(',', 1)[0].trim() ??
    (host?.startsWith('localhost') ? 'http' : 'https')
  return `${protocol}://${host}`
}
