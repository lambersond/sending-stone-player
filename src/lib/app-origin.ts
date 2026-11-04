import { headers } from 'next/headers'

/** The first of a forwarded header's values: the one the proxy nearest the browser set. */
const first = (value: string | null) => value?.split(',', 1)[0].trim()

/**
 * The origin this app is being served from, as the browser sees it, such as
 * https://sending-stone.example.com. Behind a proxy, from the forwarded headers it sets.
 */
export async function appOrigin(): Promise<string> {
  const request = await headers()
  const host = first(request.get('x-forwarded-host')) ?? request.get('host')
  const protocol =
    first(request.get('x-forwarded-proto')) ??
    (host?.startsWith('localhost') ? 'http' : 'https')
  return `${protocol}://${host}`
}
