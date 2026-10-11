import clsx from 'clsx'
import { DieIcon, type DieSides } from '@/components/icons'

/** A hit die's shape, by its size, such as "d10"; none for a size there's no icon of. */
export function HitDieIcon({
  die,
  className,
}: Readonly<{ die: string; className?: string }>) {
  const sides = SIDES.get(die)
  return (
    sides && <DieIcon sides={sides} className={clsx('shrink-0', className)} />
  )
}

/** The sizes of hit die there's an icon of, by their names. */
const SIDES = new Map<string, DieSides>(
  ([4, 6, 8, 10, 12, 20] as const).map(sides => [`d${sides}`, sides]),
)
