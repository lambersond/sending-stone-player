import { GM_WORDS, GM_WORDS_AFTER } from '../../utils/gm-words'

/**
 * The mark of a roll of the Gamemaster's, as the chat marks a message made for one: in the light
 * theme, in the accent's deeper shade, as the accent on its own tint falls short of WCAG AA this
 * small.
 */
export function GmPill() {
  return (
    <span
      title={GM_WORDS}
      className='shrink-0 rounded-full bg-primary/10 px-1.5 text-[11px] font-bold text-primary-text'
    >
      GM<span className='sr-only'>, {GM_WORDS_AFTER}</span>
    </span>
  )
}
