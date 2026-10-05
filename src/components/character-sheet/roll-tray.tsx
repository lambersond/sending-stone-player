import clsx from 'clsx'
import { Dices } from 'lucide-react'
import { formatModifier } from '@/utils/format-modifier'
import type { LocalRoll } from '@/hooks/use-sheet-roller'

/**
 * The player's rolls, newest first: the latest in full, the rest on request. They are kept on
 * this page only, which the tray says, so no one expects them to have reached the table.
 */
export function RollTray({
  rolls,
  rolling,
}: Readonly<{ rolls: LocalRoll[]; rolling: boolean }>) {
  const [latest, ...earlier] = rolls
  let status = (
    <p className='flex items-center gap-2 text-sm text-text-secondary'>
      <Dices aria-hidden className='size-5 shrink-0 text-primary' />
      <span>
        Tap an ability or skill to roll it. Right-click or long-press it for
        advantage, disadvantage or extra dice.
      </span>
    </p>
  )
  if (rolling) {
    status = (
      <p className='flex items-center gap-2 text-sm font-semibold'>
        <Dices
          aria-hidden
          className='size-5 shrink-0 text-primary motion-safe:animate-spin'
        />
        Rolling…
      </p>
    )
  } else if (latest) {
    status = <RollResult roll={latest} />
  }

  return (
    <section
      aria-label='Your rolls'
      className='shrink-0 border-t border-border bg-card px-4 py-3 md:px-8'
    >
      <div className='mx-auto flex max-w-5xl flex-col gap-2'>
        <div role='status' aria-live='polite'>
          {status}
        </div>
        {earlier.length > 0 && (
          <details className='group text-sm'>
            <summary className='cursor-pointer text-xs font-semibold text-text-secondary hover:text-text-primary'>
              Earlier rolls ({earlier.length})
            </summary>
            <ol className='mt-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto'>
              {earlier.map(roll => (
                <li
                  key={roll.id}
                  className='flex items-baseline justify-between gap-3'
                >
                  <span className='truncate'>{roll.label}</span>
                  <span className='shrink-0 text-xs text-text-secondary tabular-nums'>
                    {breakdown(roll)} ={' '}
                    <span className='text-sm font-semibold text-text-primary'>
                      {roll.total}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </details>
        )}
        <p className='text-[11px] text-text-secondary'>
          Only you see these rolls for now. They aren&apos;t sent to your
          Gamemaster&apos;s game.
        </p>
      </div>
    </section>
  )
}

function RollResult({ roll }: Readonly<{ roll: LocalRoll }>) {
  const critical = roll.natural === 20
  const fumble = roll.natural === 1
  let extra = ''
  if (roll.advantage === 'adv') extra = 'Advantage'
  if (roll.advantage === 'dis') extra = 'Disadvantage'
  return (
    <div className='flex items-center gap-3'>
      <span
        className={clsx(
          'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
          critical && 'bg-gold text-on-gold',
          fumble && 'bg-ruby text-on-ruby',
          !critical && !fumble && 'bg-primary/10 text-primary',
        )}
      >
        {roll.total}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          <Dice roll={roll} /> {formatModifier(roll.modifier)}
          {roll.extras.map(({ text, values }, index) => (
            <span key={index}>
              {' '}
              {text}
              {values.length > 0 && ` (${values.join(', ')})`}
            </span>
          ))}
          {extra && ` · ${extra}`}
          {critical && ' · Natural 20'}
          {fumble && ' · Natural 1'}
        </p>
      </div>
    </div>
  )
}

/** The d20s thrown, the one that didn't count struck through. */
function Dice({ roll }: Readonly<{ roll: LocalRoll }>) {
  const kept = roll.d20s.indexOf(roll.natural)
  return (
    <>
      d20{' '}
      {roll.d20s.map((value, index) => (
        <span key={index}>
          {index > 0 && ' '}
          {index === kept ? (
            <span className='font-semibold text-text-primary'>{value}</span>
          ) : (
            <s>{value}</s>
          )}
        </span>
      ))}
    </>
  )
}

function breakdown(roll: LocalRoll): string {
  return [
    roll.natural,
    formatModifier(roll.modifier),
    ...roll.extras.map(({ value }) => formatModifier(value)),
  ].join(' ')
}
