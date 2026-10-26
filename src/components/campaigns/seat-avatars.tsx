import type { Seat } from '@/utils/campaign-order'

/**
 * A campaign's seats on its row (round 0.39.0): up to five overlapping circles, each with two
 * letters of its player's name, or a dashed question mark for a character no player has chosen
 * yet, each titled with who sits there; then how many of its characters are chosen. The circles
 * are drawn for the eye: the count says it for a screen reader. Never a sign-in picture, which
 * would show the Gamemaster their players' account pictures.
 */
export function SeatAvatars({
  seats,
}: Readonly<{ seats: { shown: Seat[]; chosen: number; total: number } }>) {
  if (seats.total === 0) {
    return (
      <span className='text-xs text-text-secondary'>No characters yet</span>
    )
  }
  return (
    <span className='inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
      <span aria-hidden data-seats className='inline-flex items-center'>
        {seats.shown.map((seat, index) =>
          seat.player ? (
            <span
              key={index}
              title={`${seat.player} as ${seat.character}`}
              className='-ml-1.5 inline-grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary-text ring-2 ring-card first:ml-0'
            >
              {seat.initials}
            </span>
          ) : (
            <span
              key={index}
              title={`${seat.character}, not chosen yet`}
              className='-ml-1.5 inline-grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-text-secondary bg-page text-[10px] font-bold text-text-secondary ring-2 ring-card first:ml-0'
            >
              ?
            </span>
          ),
        )}
      </span>
      <span className='text-xs text-text-secondary'>
        {seats.chosen} of {seats.total} characters chosen
      </span>
    </span>
  )
}
