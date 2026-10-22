import { z } from 'zod'
import { MOST_NOTE_BODY, MOST_NOTE_TITLE } from '@/constants/notes'
import { NOTE_ID } from '@/utils/note-id'

// What a page sends to write journal notes (round 0.34.0 §8.3), from module 0.34.0: each is strict,
// so a body naming anything more, such as a note's id or whose it is, is refused. Which book it's
// in, who writes it and the new note's id all come from the seat and the server, never the body.

export { NOTE_ID } from '@/utils/note-id'

/** A title: one line, trimmed, of 1 to 200 characters. */
const title = z
  .string()
  .trim()
  .min(1)
  .max(MOST_NOTE_TITLE)
  .refine(text => !/[\n\r]/.test(text), { message: 'One line' })

/** A note's Markdown, of at most 20,000 characters; empty is a note with nothing written yet. */
const body = z.string().max(MOST_NOTE_BODY)

/** The chapter an entry is in, or none. */
const chapterId = z.string().regex(NOTE_ID).nullable()

/** A note or chapter to add: a chapter has no body nor chapter, an entry's body is '' if unset. */
export const noteInputSchema = z
  .strictObject({
    role: z.enum(['chapter', 'entry']),
    title,
    body: body.optional(),
    chapterId: chapterId.optional(),
  })
  .superRefine((input, context) => {
    if (input.role !== 'chapter') return
    for (const field of ['body', 'chapterId'] as const) {
      if (input[field] !== undefined) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: 'A chapter has none',
        })
      }
    }
  })
  .transform(input =>
    input.role === 'entry'
      ? {
          ...input,
          body: input.body ?? '',
          // eslint-disable-next-line unicorn/no-null -- an entry in no chapter
          chapterId: input.chapterId ?? null,
        }
      : { role: input.role, title: input.title },
  )

/**
 * A change to a note or chapter, from what the page last saw of it. Whether its body and chapter
 * may be given depends on what it changes, which only the server knows (`checkChange`).
 */
export const noteChangeSchema = z.strictObject({
  title,
  body: body.optional(),
  chapterId: chapterId.optional(),
  stamp: z.string().min(1).max(80),
})

/** The seat's choice where the game didn't take its change. */
export const noteResolveSchema = z.strictObject({
  resolve: z.enum(['mine', 'theirs']),
  stamp: z.string().min(1).max(80),
})

/** A note's Markdown to see as it will be drawn, nothing stored. */
export const notePreviewSchema = z.strictObject({ body })

/** A change, checked against what it changes: a chapter's has only its title. */
export function checkChange(
  change: z.output<typeof noteChangeSchema>,
  role: 'chapter' | 'entry',
): { field: string } | undefined {
  if (role !== 'chapter') return
  if (change.body !== undefined) return { field: 'body' }
  if (change.chapterId !== undefined) return { field: 'chapterId' }
}
