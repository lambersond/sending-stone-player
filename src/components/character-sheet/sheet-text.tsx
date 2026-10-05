'use client'

import { useEffect, useState } from 'react'

/**
 * Descriptions already loaded on this page, by character and hash. The same hash always names the
 * same description, so opening one again shows it at once.
 */
const loaded = new Map<string, string>()

/**
 * A description from the sheet, such as a feature's, loaded when it is first shown. The server
 * sanitised it when the Gamemaster's game sent it.
 */
export function SheetText({
  characterId,
  hash,
}: Readonly<{ characterId: string; hash: string }>) {
  const key = `${characterId}/${hash}`
  const [html, setHtml] = useState(() => loaded.get(key))
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

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

  if (html !== undefined) {
    // Sanitised by the server when the game sent it.
    return (
      <div className='sheet-text' dangerouslySetInnerHTML={{ __html: html }} />
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
