'use client'

import { useState } from 'react'
import { Check, Copy, Radio } from 'lucide-react'
import { gameHost } from '@/utils/game-host'
import type { Character } from '@/types/character'

type Props = { character: Character; listenerUrl: string }

/** Shown until the game's Gamemaster has sent anything, with what they need to set up. */
export function WaitingForTable({ character, listenerUrl }: Readonly<Props>) {
  return (
    <div className='mx-auto flex max-w-xl flex-col items-center px-4 py-12 text-center md:py-16'>
      <Radio aria-hidden className='size-8 text-primary' />
      <h2 className='mt-4 text-lg font-semibold'>Waiting for the table</h2>
      <p className='mt-1 text-sm text-text-secondary'>
        Nothing has arrived from {gameHost(character.gameUrl)} yet. The chat and
        combat tracker show up here once your Gamemaster connects Sending Stone.
      </p>
      <section
        aria-labelledby='gm-setup-heading'
        className='mt-8 w-full rounded-2xl border border-border bg-card p-5 text-left'
      >
        <h3 id='gm-setup-heading' className='font-semibold'>
          For your Gamemaster
        </h3>
        <ol className='mt-3 flex list-decimal flex-col gap-3 pl-5 text-sm text-text-secondary marker:text-text-primary'>
          <li>Install the Sending Stone module in the game on The Forge.</li>
          <li>
            In <em>Configure Connection</em>, set the listener URL to
            <ListenerUrl url={listenerUrl} />
            and enter the shared secret this app was set up with.
          </li>
          <li>
            Under <em>Choose Characters</em>, connect {character.name}, and
            switch on <em>Send Chat Events</em> and <em>Send Combat Events</em>.
          </li>
        </ol>
      </section>
    </div>
  )
}

function ListenerUrl({ url }: Readonly<{ url: string }>) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Copying is a convenience; the address is on screen to copy by hand.
    }
  }
  return (
    <span className='my-2 flex items-center gap-2 rounded-lg border border-border bg-page py-1 pr-1 pl-3'>
      <code className='min-w-0 flex-1 truncate font-mono text-xs text-text-primary'>
        {url}
      </code>
      <button
        type='button'
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy listener URL'}
        title={copied ? 'Copied' : 'Copy'}
        className='rounded-md p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
      >
        {copied ? (
          <Check aria-hidden className='size-4 text-primary' />
        ) : (
          <Copy aria-hidden className='size-4' />
        )}
      </button>
    </span>
  )
}
