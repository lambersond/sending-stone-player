'use client'

import { use } from 'react'
import { WildShapeContext } from './use-wild-shape-row'
import { aboutWords } from '@/utils/wild-shape-words'

/** Features' line for the Wild Shape row, from what the rules allow the druid now. */
export function WildShapeAbout({ id }: Readonly<{ id: string }>) {
  const ws = use(WildShapeContext)
  if (!ws.block || ws.block.item !== id) return
  return (
    <p className='text-xs text-text-secondary'>
      {aboutWords(ws.block, ws.name)}
    </p>
  )
}
