// A journal note's Markdown as Foundry renders it (round 0.34.0 §2.10): showdown 2.1.0 with
// Foundry's own options, on the server only, as nothing in the browser renders a note. Foundry's
// enrichers, such as @UUID[Actor.x]{Thorin} and [[/r 1d20+5]], are text to showdown, and work in
// Foundry once it renders them there; here each is shown as its label, or its formula, in bold,
// never as a link.
import sanitizeHtml from 'sanitize-html'
import showdown from 'showdown'

/** Foundry's showdown options (CONST.SHOWDOWN_OPTIONS, Foundry 13 and 14). */
export const FOUNDRY_SHOWDOWN = {
  disableForced4SpacesIndentedSublists: true,
  noHeaderId: true,
  parseImgDimensions: true,
  strikethrough: true,
  tables: true,
  tablesHeaderId: true,
} as const

/** One converter for the process: it keeps nothing of one note for the next. */
let converter: showdown.Converter | undefined

function convert(markdown: string): string {
  converter ??= new showdown.Converter(FOUNDRY_SHOWDOWN)
  return converter.makeHtml(markdown)
}

/** A note's Markdown as Foundry renders it, before sanitising: Foundry's enrichers as labels. */
export function renderNoteMarkdown(markdown: string): string {
  return convert(enrichMarkdown(markdown))
}

/** A note's Markdown as Foundry converts it, with nothing else done: what the H1/H2 rule reads. */
export function convertNoteMarkdown(markdown: string): string {
  return convert(markdown)
}

/** Whether converted HTML has an H1 or H2 (the rule, §2.10). */
export function hasBigHeading(html: string): boolean {
  // Raw HTML written in the Markdown passes through showdown as it is, in any case, so its tags
  // are read as a parser reads them, as the module reads Foundry's: never one in a comment, an
  // attribute or a script, nor the text of code, which showdown escapes.
  let found = false
  sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    onOpenTag: name => {
      if (name === 'h1' || name === 'h2') found = true
    },
  })
  return found
}

/** HTML with its comments taken out, which no parser reads as tags. */
function withoutComments(html: string): string {
  return html.replaceAll(/<!--[\s\S]*?(?:-->|$)/g, '')
}

/**
 * Foundry's HTML for a note written in its own editor, with its enrichers shown as they are in
 * Markdown: in its text alone, never inside `<code>` or `<pre>`, before it's sanitised.
 */
export function enrichNoteHtml(html: string): string {
  let inCode = 0
  return withoutComments(html)
    .split(/(<[^>]*>)/)
    .map(part => {
      const tag = /^<(\/?)(code|pre)\b/i.exec(part)
      if (tag) {
        inCode = Math.max(0, inCode + (tag[1] ? -1 : 1))
        return part
      }
      // Its text is HTML already, so what's found in it is kept as it's written.
      return part.startsWith('<') || inCode > 0
        ? part
        : enrich(part, text => text)
    })
    .join('')
}

/** The characters a bold label or formula is written with, so that showdown reads it as text. */
const SPECIAL: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '*': '&#42;',
  _: '&#95;',
  '~': '&#126;',
  '`': '&#96;',
  '[': '&#91;',
  ']': '&#93;',
  '\\': '&#92;',
  '#': '&#35;',
}

/** Text made safe to sit in Markdown as HTML, and to read as nothing but text. */
function escapeText(text: string): string {
  return text.replaceAll(/[&<>"'*_~`[\]\\#]/g, char => SPECIAL[char])
}

/**
 * Foundry's enrichers in a piece of text as bold text: a document link as its label, or the last
 * part of what it links to; a roll as its label, or its formula.
 * @param escape - How what's found is written: escaped for Markdown, kept as it is for HTML.
 */
function enrich(text: string, escape: (text: string) => string): string {
  const bold = (inner: string) => `<strong>${escape(inner)}</strong>`
  return text
    .replaceAll(
      /@[A-Za-z]\w*\[([^\]\n]+)\]\{([^}\n]*)\}/g,
      (_, _target: string, label: string) => bold(label),
    )
    .replaceAll(/@[A-Za-z]\w*\[([^\]\n]+)\]/g, (_, target: string) =>
      bold(target.split('.').at(-1) ?? target),
    )
    .replaceAll(
      /\[\[\/[A-Za-z]+[ \t]+([^\]\n]*?)\]\]\{([^}\n]*)\}/g,
      (_, _formula: string, label: string) => bold(label),
    )
    .replaceAll(/\[\[\/[A-Za-z]+[ \t]+([^\]\n]*?)\]\]/g, (_, formula: string) =>
      bold(formula.trim()),
    )
    .replaceAll(/\[\[([^\]\n/][^\]\n]*?)\]\]/g, (_, formula: string) =>
      bold(formula.trim()),
    )
}

/** A fenced code block's opening line, as showdown reads one. */
const FENCE = /^ {0,3}(`{3,}|~{3,}) *[^\s`~]*$/

/**
 * A note's Markdown with Foundry's enrichers as bold text, outside its code: fenced blocks,
 * indented ones, and spans in backticks, which show what's in them as it's written.
 */
function enrichMarkdown(markdown: string): string {
  const lines = markdown.replaceAll(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let prose: string[] = []
  const flush = () => {
    if (prose.length > 0) out.push(enrichProse(prose.join('\n')))
    prose = []
  }
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const fence = FENCE.exec(line)?.[1]
    const close =
      fence === undefined
        ? -1
        : lines.findIndex(
            (other, at) =>
              at >= index + 2 && new RegExp(`^ {0,3}${fence}`).test(other),
          )
    if (close !== -1) {
      flush()
      out.push(...lines.slice(index, close + 1))
      index = close + 1
      continue
    }
    // Indented code: lines of four spaces or a tab after a blank line, and the blank lines in it.
    const previous = index === 0 ? '' : lines[index - 1]
    if (/^( {4}|\t)/.test(line) && previous.trim() === '' && !inList(prose)) {
      flush()
      while (
        index < lines.length &&
        (/^( {4}|\t)/.test(lines[index]) || lines[index].trim() === '')
      ) {
        out.push(lines[index++])
      }
      continue
    }
    prose.push(line)
    index++
  }
  flush()
  return out.join('\n')
}

/** Whether these lines end in a list, whose indented lines are its items' and not code. */
function inList(lines: string[]): boolean {
  const last = lines.findLast(line => line.trim() !== '' && !/^\s/.test(line))
  return last !== undefined && /^ {0,3}([*+-]|\d+\.)[ \t]+/.test(last)
}

/** Prose with its enrichers made bold, but not what's in backticks. */
function enrichProse(text: string): string {
  return text
    .split(/((?<!\\)(`+)[\s\S]*?[^`]\2(?!`))/)
    .map((part, index) => {
      // split's captures: each third part is a code span, followed by its backticks alone.
      if (index % 3 === 1) return part
      if (index % 3 === 2) return ''
      return enrich(part, escapeText)
    })
    .join('')
}
