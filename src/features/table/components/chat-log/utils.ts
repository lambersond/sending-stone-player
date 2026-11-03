import clsx from 'clsx'

/**
 * A message's bubble, its pointed corner toward the speaker's avatar; gold all round for a
 * critical. It sets one border colour only: of two, the one the stylesheet sets later wins,
 * whatever their order here, and gold comes before the player's own and a whisper's.
 */
export const bubble = (whisper: boolean, mine: boolean, critical = false) =>
  clsx(
    'max-w-full border px-3 py-2.5',
    mine ? 'rounded-[14px_4px_14px_14px]' : 'rounded-[4px_14px_14px_14px]',
    critical ? 'border-gold' : edgeOf(whisper, mine),
    whisper && 'border-dashed bg-whisper/5',
    !whisper && (mine ? 'bg-primary/10' : 'bg-card'),
  )

/** A bubble's border colour, for a whisper, the player's own message or anyone else's. */
function edgeOf(whisper: boolean, mine: boolean): string {
  if (whisper) return 'border-whisper/60'
  return mine ? 'border-primary/30' : 'border-border'
}

/** The article before what a roll request card asks for: "an" before a vowel, else "a". */
export function article(title: string): string {
  return /^[AEIOU]/.test(title) ? 'an' : 'a'
}
