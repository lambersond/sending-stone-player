import type { FavoriteTarget } from '@/types/roll'

/** What a row's favorites key names, as the app adds and removes it: an item or an effect alone. */
export function keyTarget(key: string | undefined): FavoriteTarget | undefined {
  const [type, ...rest] = key?.split(':') ?? []
  const id = rest.join(':')
  if (!id) return undefined
  return type === 'item' || type === 'effect' ? { type, id } : undefined
}
