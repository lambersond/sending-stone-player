/** A section's heading on the sheet, such as Abilities or Fighter Features. */
export function SheetHeading({
  id,
  children,
}: Readonly<{ id: string; children: string }>) {
  return (
    <h2
      id={id}
      className='text-xs font-semibold tracking-wider text-text-secondary uppercase'
    >
      {children}
    </h2>
  )
}
