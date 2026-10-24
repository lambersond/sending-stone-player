import { SheetFact } from './sheet-fact'
import { SheetHeading } from './sheet-heading'
import { SheetText } from './sheet-text'
import { JournalCard, type NotesPlace } from '@/components/notes'
import { useSheetId } from '@/hooks/use-sheet-ids'
import type { SheetDetails } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/**
 * Who the character is, as dnd5e's Biography tab tells it: alignment, age and the like, their
 * experience, their personality and appearance, and their story. A roll in their story is named
 * for the character, as the game names it. From module 0.34.0, their own journal notes come
 * first, as the one part of the tab the player writes in, and during play: from 0.35.0, a card
 * that opens the journal, so the tab doesn't grow with it.
 */
export function BiographyTab({
  characterId,
  name,
  sheet,
  notes,
}: Readonly<{
  characterId: string
  /** The character's name. */
  name: string
  sheet: TableSheet
  /** Where the character's own notes are read and written, at the table. */
  notes?: NotesPlace
}>) {
  const { about, personality, appearance, xp, biography } = sheet.details
  const empty =
    about.length === 0 &&
    personality.length === 0 &&
    !appearance &&
    !xp &&
    !biography
  // Unique on the page, where a companion's pane is mounted beside its character's.
  const detailsId = useSheetId('details-heading')
  const personalityId = useSheetId('personality-heading')
  const appearanceId = useSheetId('appearance-heading')
  const biographyId = useSheetId('biography-heading')
  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {notes && <JournalCard kind='personal' look='sheet' {...notes} />}

      {(xp || about.length > 0) && (
        <section aria-labelledby={detailsId} className='flex flex-col gap-2'>
          <SheetHeading id={detailsId}>Details</SheetHeading>
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
          aria-labelledby={personalityId}
          className='flex flex-col gap-2'
        >
          <SheetHeading id={personalityId}>Personality</SheetHeading>
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
        <section aria-labelledby={appearanceId} className='flex flex-col gap-2'>
          <SheetHeading id={appearanceId}>Appearance</SheetHeading>
          <p className='rounded-2xl border border-border bg-card px-4 py-3 whitespace-pre-line'>
            {appearance}
          </p>
        </section>
      )}

      {biography && (
        <section aria-labelledby={biographyId} className='flex flex-col gap-2'>
          <SheetHeading id={biographyId}>Biography</SheetHeading>
          <div className='rounded-2xl border border-border bg-card px-4 py-3'>
            <SheetText
              characterId={characterId}
              hash={biography}
              origin={{ name }}
            />
          </div>
        </section>
      )}

      {empty && (
        <p className='text-sm text-text-secondary'>
          Nothing is written about {name} in Foundry yet.
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
