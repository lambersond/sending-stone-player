/** The pages a game fills, without the site's header: a character's sheet or its party's, as its
 * player or its campaign's Gamemaster sees it (#156). */
export const TABLE_PAGES: readonly RegExp[] = [
  /^\/characters\/[^/]+\/?$/,
  /^\/characters\/[^/]+\/party\/[^/]+\/?$/,
  /^\/campaigns\/[^/]+\/characters\/[^/]+\/?$/,
  /^\/campaigns\/[^/]+\/party\/[^/]+\/?$/,
]
export function isTablePage(pathname: string): boolean {
  return TABLE_PAGES.some(page => page.test(pathname))
}
