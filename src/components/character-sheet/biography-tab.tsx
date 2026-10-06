import { SheetFact } from './sheet-fact'
import { SheetHeading } from './sheet-heading'
import { SheetText } from './sheet-text'
import type { SheetDetails } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/**
 * Who the character is, as dnd5e's Biography tab tells it: alignment, age and the like, their
 * experience, their personality and appearance, and their story.
 */
export function BiographyTab({
  characterId,
  sheet,
}: Readonly<{ characterId: string; sheet: TableSheet }>) {
  const { about, personality, appearance, xp, biography } = sheet.details
  const empty =
    about.length === 0 &&
    personality.length === 0 &&
    !appearance &&
    !xp &&
    !biography
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {(xp || about.length > 0) && (
        <section
          aria-labelledby='details-heading'
          className='flex flex-col gap-2'
        >
          <SheetHeading id='details-heading'>Details</SheetHeading>
          <dl className='grid grid-cols-2 gap-2 @xl:grid-cols-4'>
            {xp && (
              <SheetFact label='Experience' className='col-span-2'>
                <Experience xp={xp} />
              </SheetFact>
            )}
            {about.map(detail => (
              <SheetFact key={detail.id} label={detail.label}>
                <span className='font-semibold break-words'>
                  {detail.value}
                </span>
              </SheetFact>
            ))}
          </dl>
        </section>
      )}

      {personality.length > 0 && (
        <section
          aria-labelledby='personality-heading'
          className='flex flex-col gap-2'
        >
          <SheetHeading id='personality-heading'>Personality</SheetHeading>
          <dl className='grid gap-2 @2xl:grid-cols-2'>
            {personality.map(detail => (
              <SheetFact key={detail.id} label={detail.label}>
                <p className='whitespace-pre-line'>{detail.value}</p>
              </SheetFact>
            ))}
          </dl>
        </section>
      )}

      {appearance && (
        <section
          aria-labelledby='appearance-heading'
          className='flex flex-col gap-2'
        >
          <SheetHeading id='appearance-heading'>Appearance</SheetHeading>
          <p className='rounded-2xl border border-border bg-card px-4 py-3 whitespace-pre-line'>
            {appearance}
          </p>
        </section>
      )}

      {biography && (
        <section
          aria-labelledby='biography-heading'
          className='flex flex-col gap-2'
        >
          <SheetHeading id='biography-heading'>Biography</SheetHeading>
          <div className='rounded-2xl border border-border bg-card px-4 py-3'>
            <SheetText characterId={characterId} hash={biography} />
          </div>
        </section>
      )}

      {empty && (
        <p className='text-sm text-text-secondary'>
          Nothing has been written about this character yet.
        </p>
      )}
    </div>
  )
}

/** Experience points, and how far the character is toward the next level. */
function Experience({ xp }: Readonly<{ xp: NonNullable<SheetDetails['xp']> }>) {
  const { value, max } = xp
  const share = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <span className='flex flex-col gap-1.5'>
      <span className='tabular-nums'>
        <span className='font-semibold'>{value.toLocaleString()}</span>
        {max !== null && ` / ${max.toLocaleString()}`} XP
      </span>
      {max !== null && max > 0 && (
        <span
          aria-hidden
          className='relative h-1.5 overflow-hidden rounded-full bg-border'
        >
          <span
            className='absolute inset-y-0 left-0 rounded-full bg-primary'
            style={{ width: `${share}%` }}
          />
        </span>
      )}
    </span>
  )
}
