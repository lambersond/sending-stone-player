'use client'

/** An editor's heading, in its pane's bar: cut short to one line, the whole of it its title. */
export function EditorHeading({
  id,
  heading,
}: Readonly<{ id: string; heading: string }>) {
  return (
    <h3
      id={id}
      title={heading}
      className='min-w-0 flex-1 truncate px-2 font-semibold'
    >
      {heading}
    </h3>
  )
}
