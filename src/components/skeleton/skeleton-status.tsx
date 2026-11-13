/**
 * What a page's skeleton says while the page reads its data (v0.48.0): "Loading…", once, to a
 * screen reader, as a status. Its blocks, and any words it shows of the page, are hidden.
 */
export function SkeletonStatus() {
  return (
    <p role='status' className='sr-only'>
      Loading…
    </p>
  )
}
