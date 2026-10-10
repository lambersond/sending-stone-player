'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  useDescriptionActions,
  type DescriptionOrigin,
} from './description-actions'
import { drawDescription, readDescription } from './description-html'
import { DescriptionLink, useLinkMenus } from './description-link'

/**
 * Descriptions already loaded on this page, by character and hash. The same hash always names the
 * same description, so opening one again shows it at once.
 */
const loaded = new Map<string, string>()

type Props = {
  characterId: string
  hash: string
  /** Where it's from, as what's rolled from it is named. */
  origin: DescriptionOrigin
}

/**
 * A description from the sheet, such as a feature's, loaded when it is first shown. The server
 * sanitised it when the Gamemaster's game sent it, and it's drawn as the page's own elements, from
 * the tags it may have, never set as HTML. Its links the game acts on, such as a saving throw it
 * calls for or the damage it deals, do so, where the sheet says what they do. Another description
 * in its place starts afresh, never showing this one while it loads.
 */
export function SheetText(props: Readonly<Props>) {
  return <LoadedText key={`${props.characterId}/${props.hash}`} {...props} />
}

function LoadedText({ characterId, hash, origin }: Readonly<Props>) {
  const key = `${characterId}/${hash}`
  const [html, setHtml] = useState(() => loaded.get(key))
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const actions = useDescriptionActions()
  const { menus, dialogs } = useLinkMenus(actions)
  // Read only where there's a browser to read it: on the server, it's still loading.
  const body = useMemo(
    () => (html === undefined ? undefined : readDescription(html)),
    [html],
  )

  useEffect(() => {
    if (loaded.has(key)) return
    const controller = new AbortController()
    fetch(`/api/characters/${characterId}/texts/${hash}`, {
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = (await response.json()) as { html: string }
        loaded.set(key, text.html)
        setHtml(text.html)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [characterId, hash, key, attempt])

  if (body) {
    return (
      <>
        <div className='sheet-text'>
          {drawDescription(body, part => (
            <DescriptionLink
              part={part}
              hash={hash}
              origin={origin}
              actions={actions}
              menus={menus}
            />
          ))}
        </div>
        {dialogs}
      </>
    )
  }
  if (failed) {
    return (
      <p className='text-sm text-text-secondary'>
        Couldn&apos;t load the description.{' '}
        <button
          type='button'
          className='font-semibold text-primary underline underline-offset-2'
          onClick={() => {
            setFailed(false)
            setAttempt(next => next + 1)
          }}
        >
          Try again
        </button>
      </p>
    )
  }
  return (
    <p aria-busy className='text-sm text-text-secondary'>
      Loading…
    </p>
  )
}
