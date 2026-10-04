/**
 * Escape the wildcards in a value compared case-insensitively: Prisma compares with ILIKE on
 * Postgres, where `%` and `_` would otherwise match anything.
 */
export const literalPattern = (value: string) =>
  value.replaceAll(/[\\%_]/g, String.raw`\$&`)
