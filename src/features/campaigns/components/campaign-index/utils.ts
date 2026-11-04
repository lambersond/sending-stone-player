/** How many campaigns the search shows, as its status line says it. */
export const countWords = (count: number) =>
  count === 1 ? '1 campaign shown' : `${count} campaigns shown`
