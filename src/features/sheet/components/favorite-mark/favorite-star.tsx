'use client'

import { Star } from 'lucide-react'

/** The star by a favorite's name, which a screen reader says as "favorite". */
export function FavoriteStar() {
  return (
    <>
      <Star aria-hidden className='size-3 shrink-0 fill-gold text-gold' />
      <span className='sr-only'>, favorite</span>
    </>
  )
}
