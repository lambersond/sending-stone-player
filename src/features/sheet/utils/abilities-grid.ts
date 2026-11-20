/**
 * The abilities' columns at each width of the sheet, narrowest first: three on a phone, four from
 * 384 px, six from 576, eight from 1024. Each class written whole, for Tailwind to find.
 */
const COLUMNS: readonly (readonly string[])[] = [
  ['grid-cols-1', 'grid-cols-2', 'grid-cols-3'],
  ['@sm:grid-cols-1', '@sm:grid-cols-2', '@sm:grid-cols-3', '@sm:grid-cols-4'],
  [
    '@xl:grid-cols-1',
    '@xl:grid-cols-2',
    '@xl:grid-cols-3',
    '@xl:grid-cols-4',
    '@xl:grid-cols-5',
    '@xl:grid-cols-6',
  ],
  [
    '@5xl:grid-cols-1',
    '@5xl:grid-cols-2',
    '@5xl:grid-cols-3',
    '@5xl:grid-cols-4',
    '@5xl:grid-cols-5',
    '@5xl:grid-cols-6',
    '@5xl:grid-cols-7',
    '@5xl:grid-cols-8',
  ],
]

/**
 * The grid of a sheet's abilities, its columns following how many there are: at each width as few
 * rows as its most columns allow, and the fewest columns that hold them, so that no row is shorter
 * than the others by more than one. Eight to a row only where the sheet is as wide as it gets, as
 * the card's numbers go: narrower, an eighth is too narrow. Six are three to a row, then all six
 * from 576 px, as ever. The table's skeleton draws it for six (v0.52.0).
 * @param count - How many abilities the sheet has.
 * @returns The grid's classes.
 */
export function abilitiesGrid(count: number): string {
  const abilities = Math.max(1, count)
  const columns = COLUMNS.map(classes =>
    Math.ceil(abilities / Math.ceil(abilities / classes.length)),
  )
  const [base, ...wider] = COLUMNS.flatMap((classes, tier) =>
    columns[tier] === columns[tier - 1] ? [] : [classes[columns[tier] - 1]],
  )
  return ['grid', base, 'gap-2', ...wider].join(' ')
}
