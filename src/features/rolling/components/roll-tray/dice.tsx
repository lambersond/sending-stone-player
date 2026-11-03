import type { LocalCheck } from '@/types/roll'

/** The d20s thrown, the one that didn't count struck through. */
export function Dice({ roll }: Readonly<{ roll: LocalCheck }>) {
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
