/*
 * Where keyboard focus goes as something goes from the page with focus on it: the places beside it,
 * read from the page as it stood. A sheet's row is an `li` whose own control is a summary, a row
 * that takes focus for its menu, or an action's name.
 */

/** A row's own control: a `SheetEntry`'s summary or focusable row, an `ActionEntry`'s name. */
const ROW_CONTROL =
  ':scope > details > summary, :scope > [tabindex="0"], :scope > button, :scope > div > button'

/**
 * A row's own control, the one that opens it or takes focus for its menu; none for no row, or one
 * with none.
 */
export function rowControlOf(
  row: Element | null | undefined,
): HTMLElement | undefined {
  return row?.querySelector<HTMLElement>(ROW_CONTROL) ?? undefined
}

/**
 * Where focus may go as an element goes, in order: the other buttons in its own group, as the
 * Currency row's Add or remove beside its Give; its row's own control, where only the element goes;
 * the next row's, then the previous row's; then the tab's panel. As a deleted effect's row hands it
 * to the row beside it, else the tab (module 0.39.0).
 * @param element - What may go, as the page stands before it does.
 */
export function placesBeside(element: HTMLElement): HTMLElement[] {
  const group = element.closest('[role="group"]')
  const together = group
    ? [...group.querySelectorAll<HTMLElement>('button')].filter(
        button => button !== element,
      )
    : []
  const row = element.closest('li')
  const panel = element.closest<HTMLElement>('[role="tabpanel"]')
  return [
    ...together,
    rowControlOf(row),
    rowControlOf(row?.nextElementSibling),
    rowControlOf(row?.previousElementSibling),
    panel ?? undefined,
  ].filter(
    (place): place is HTMLElement => place !== undefined && place !== element,
  )
}
