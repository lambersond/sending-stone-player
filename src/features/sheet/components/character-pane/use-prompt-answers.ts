import { useEffect, useRef } from 'react'
import { useShownPrompts } from '@/hooks/use-waiting-prompts'
import type { SheetRoll } from '@/types/roll'
import type { TablePrompt } from '@/types/table'

/**
 * What the game asks, and what Midi-QOL is doing with what it asked, or did a moment ago
 * (`waiting`); and an answer to it (`answering`), while its dice are typed in, until when the game
 * waits for it, dnd5e's and Midi-QOL's alike, as the app refuses either after; and how it's told
 * that it was answered or closed elsewhere: rolled in Foundry, answered from the other seat, or
 * left to Midi-QOL, its dialog then closing, as nothing here could answer it any more.
 */
export function usePromptAnswers(prompts?: TablePrompt[]) {
  const waiting = useShownPrompts(prompts)
  const answers = useRef(new Map<string, AbortController>())
  useEffect(() => {
    for (const [id, controller] of answers.current) {
      const prompt = waiting.find(each => each.id === id)
      if (prompt && !prompt.closed) continue
      controller.abort()
      answers.current.delete(id)
    }
  }, [waiting])
  const answering = (request: SheetRoll): SheetRoll => {
    const { source } = request
    const id = source && 'prompt' in source ? source.prompt : undefined
    const prompt = id ? waiting.find(each => each.id === id) : undefined
    if (!prompt) return request
    let controller = answers.current.get(prompt.id)
    if (!controller) {
      controller = new AbortController()
      answers.current.set(prompt.id, controller)
    }
    return { ...request, until: prompt.expiresAt, signal: controller.signal }
  }
  return { waiting, answering }
}
