import type { LocalExtra } from '@/types/roll'

/**
 * Each term of a roll with no d20, with its dice: 1d10 (7) +2. A term whose dice Foundry works out,
 * such as 2d6r<=2's, shows every die thrown, those rerolled or dropped struck through, such as
 * 2d6r<=2 (1, 5, 4) with its 1 rerolled; or, for a roll the game throws those again for itself,
 * only the first throw, which is what the game was sent (`firstThrow`).
 */
export function Terms({
  terms,
  firstThrow = false,
}: Readonly<{ terms: LocalExtra[]; firstThrow?: boolean }>) {
  return terms.map(({ text, values, thrown }, at) => (
    <span key={at}>
      {at > 0 && ' '}
      {text}
      {values.length > 0 && (
        <>
          {' ('}
          <span className='font-semibold text-text-primary'>
            {thrown && !firstThrow
              ? thrown.map((die, index) => (
                  <span key={index}>
                    {index > 0 && ', '}
                    {die.active ? die.value : <s>{die.value}</s>}
                  </span>
                ))
              : values.join(', ')}
          </span>
          )
        </>
      )}
    </span>
  ))
}
