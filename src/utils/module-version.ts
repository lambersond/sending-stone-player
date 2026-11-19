/** Is a version, such as "0.44.0", this one or a later one, by its numbers? One without is not. */
export function atLeast(
  version: string | null | undefined,
  from: readonly number[],
): boolean {
  const parts = String(version ?? '')
    .split('.')
    .map(part => Number.parseInt(part, 10))
  for (const [index, least] of from.entries()) {
    const part = parts[index] ?? 0
    if (Number.isNaN(part)) return false
    if (part !== least) return part > least
  }
  return true
}
