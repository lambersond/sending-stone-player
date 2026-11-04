'use client'

/** For a character that has left its campaign's game: only public messages show. */
export function NotConnected({
  name,
  campaign,
  addBack,
}: Readonly<{ name: string; campaign: string; addBack: string }>) {
  return (
    <p className='shrink-0 border-b border-warning/40 bg-warning/10 px-4 py-2.5 text-sm md:px-8'>
      {name} is no longer one of {campaign}&apos;s characters, so only public
      messages show here. {addBack}
    </p>
  )
}
