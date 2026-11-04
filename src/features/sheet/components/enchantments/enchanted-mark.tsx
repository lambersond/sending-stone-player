'use client'

import { Sparkles } from 'lucide-react'

/** The sparkle by an enchanted item's name, which a screen reader says as "Enchanted". */
export function EnchantedMark() {
  return (
    <Sparkles
      role='img'
      aria-label='Enchanted'
      className='size-3 shrink-0 text-primary'
    />
  )
}
