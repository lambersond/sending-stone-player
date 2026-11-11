import { TidyChip } from '../tidy-chip/tidy-chip'
import { TidyDates } from '../tidy-lines/tidy-dates'
import type { NoteTidyView } from '@/types/notes'

/**
 * A Tidy 5e Sheets entry as their page lists it (module 0.44.0): its title, a button over the whole
 * card that opens it; its chip; when the app first saw it and last saw it change; and the start of
 * its text. Read only: no Move, Edit or Delete.
 */
export function TidyCard({
  entry,
  text,
  onOpen,
}: Readonly<{ entry: NoteTidyView; text: string; onOpen: () => void }>) {
  return (
    <article className='relative flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/50'>
      <div className='flex items-start gap-2'>
        <h4 className='min-w-0 flex-1 pt-0.5 font-semibold break-words'>
          <button
            type='button'
            onClick={onOpen}
            className='text-left after:absolute after:inset-0 after:rounded-2xl'
          >
            {entry.title}
          </button>
        </h4>
        <TidyChip from={entry.from} />
      </div>
      <p className='-mt-1 text-xs text-text-secondary'>
        <TidyDates entry={entry} undated='In Tidy 5e Sheets' />
      </p>
      {text && <p className='line-clamp-3 text-sm break-words'>{text}</p>}
    </article>
  )
}
