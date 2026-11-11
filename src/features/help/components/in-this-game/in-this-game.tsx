import { useId } from 'react'
import clsx from 'clsx'
import type { HelpBox } from '@/features/help/types'

/**
 * The "In this game" box (H2 B), open at the top of Help (D3): each row says in words what the
 * character's campaign allows now, its dot only echoing them, filled for on and hollow for off;
 * then why something may be missing.
 */
export function InThisGame({ box }: Readonly<{ box: HelpBox }>) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className='overflow-hidden rounded-xl border border-border'
    >
      <h3 id={titleId} className='bg-page px-3 py-2.5 text-sm font-semibold'>
        {box.title}
      </h3>
      <dl>
        {box.rows.map(row => (
          <div
            key={row.label}
            className='flex justify-between gap-3 border-t border-border px-3 py-2 text-[13px]'
          >
            <dt className='min-w-0 flex-1 text-text-secondary'>{row.label}</dt>
            <dd
              className={clsx(
                'flex max-w-[65%] shrink-0 items-start justify-end gap-1.5 text-right',
                row.on ? 'font-medium' : 'text-text-secondary',
              )}
            >
              <span
                aria-hidden
                className={clsx(
                  'mt-1.5 size-2 shrink-0 rounded-full',
                  row.on
                    ? 'bg-primary'
                    : 'border-[1.5px] border-text-secondary',
                )}
              />
              {row.says}
            </dd>
          </div>
        ))}
      </dl>
      {box.notes.map(note => (
        <p
          key={note.text}
          className={clsx(
            'border-t border-border px-3 py-2.5 text-xs leading-normal',
            note.warn ? 'text-warning' : 'text-text-secondary',
          )}
        >
          {note.text}
        </p>
      ))}
    </section>
  )
}
