/**
 * A note's headings a level up: the server draws a note's own headings two levels down, h1-h3 as
 * h5 and h4-h6 as h6, under the h4 a note had in v0.34; under the reader's h3 they're one level
 * down, so each h5 becomes an h4 and each h6 an h5, their content and attributes kept.
 */
export function lift(body: HTMLElement): HTMLElement {
  const lifted = body.cloneNode(true) as HTMLElement
  const document = lifted.ownerDocument
  for (const heading of lifted.querySelectorAll('h5, h6')) {
    const raised = document.createElement(
      heading.localName === 'h5' ? 'h4' : 'h5',
    )
    for (const { name, value } of heading.attributes) {
      raised.setAttribute(name, value)
    }
    raised.append(...heading.childNodes)
    heading.replaceWith(raised)
  }
  return lifted
}
