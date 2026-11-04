/** A random secret, as long and URL-safe as the server's. */
export function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}
