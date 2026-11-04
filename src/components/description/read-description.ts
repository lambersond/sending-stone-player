/**
 * A description's HTML, read as the browser reads it, without running or loading anything: none
 * where there's no browser to read it, as when the page is drawn on the server.
 * @param html - A description, as the server kept it.
 * @returns Its body.
 */
export function readDescription(html: string): HTMLElement | undefined {
  if (typeof DOMParser === 'undefined') return undefined
  return new DOMParser().parseFromString(html, 'text/html').body
}
