/**
 * Where to send someone after signing in, if it is a page of this app. A path from the query
 * string is attacker-controlled, so anything that could leave the site, such as `//evil.example`
 * or `https://evil.example`, is refused.
 * @returns The path, or undefined if it is not one of this app's.
 */
export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!value.startsWith('/') || value.startsWith('//')) return undefined
  if (/[\\\s]/.test(value)) return undefined
  return value
}
