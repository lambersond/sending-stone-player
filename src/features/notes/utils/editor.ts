import type { NoteDraft } from '@/features/notes/types'
import type { NoteChange, NoteInput } from '@/types/notes'

/** The most heading hints listed one by one, before the rest are counted. */
const MOST_HINTS = 3

/**
 * The editor's hint for the lines that would be the journal's own headings, one sentence a line,
 * at most three, then how many more: the scanner's lines, from 1, as showdown makes them h1 or h2,
 * and as a refusal's lines number them. A line it found under-ruled is the text above the rule,
 * which the hint names, as the rule makes it the heading.
 */
export function headingHint(markdown: string, lines: number[]): string {
  if (lines.length === 0) return ''
  const rows = markdown.split(/\r\n|\r|\n/)
  const said = lines.slice(0, MOST_HINTS).map(line => {
    const text = (rows[line - 1] ?? '')
      .replace(/^(?:[ \t]*>)+/, '')
      .replace(/^(?:[ \t]*(?:[*+-]|\d+\.)[ \t]+)+/, '')
      .trimStart()
    return text.startsWith('#')
      ? String.raw`Line ${line} is a # or ## heading. Use ### or more, or put a \ before the #.`
      : `Line ${line} has = or - on the line below it, which makes it a heading. Leave a blank line between them.`
  })
  const more = lines.length - said.length
  return more > 0 ? `${said.join(' ')} …and ${more} more` : said.join(' ')
}

/** A draft not yet made, as it's sent to make its note or chapter. */
export function inputOf(made: NoteDraft): NoteInput {
  const title = made.title.trim()
  return made.role === 'entry'
    ? {
        role: 'entry',
        title,
        body: made.body,
        chapterId: made.chapterId,
      }
    : { role: 'chapter', title }
}

/** A draft of a change, as it's sent to change its note or chapter from the stamp it began at. */
export function changeOf(made: NoteDraft): NoteChange {
  const title = made.title.trim()
  const stamp = made.stamp ?? ''
  return made.role === 'entry'
    ? { title, body: made.body, chapterId: made.chapterId, stamp }
    : { title, stamp }
}
