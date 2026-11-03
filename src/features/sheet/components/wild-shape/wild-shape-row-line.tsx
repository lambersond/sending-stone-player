'use client'

import { use } from 'react'
import { WildShapeContext } from './context'
import { isRow, rowOf } from './utils'

/** The Wild Shape row's small line under its name: what Wild Shape does now, or why not. */
export function WildShapeRowLine({ id }: Readonly<{ id: string }>) {
  const ws = use(WildShapeContext)
  const row = isRow(ws, id) ? rowOf(ws) : undefined
  if (!row) return
  return (
    <p className='px-2.5 pb-1.5 pl-[3.25rem] text-xs text-text-secondary'>
      {row.line}
    </p>
  )
}
