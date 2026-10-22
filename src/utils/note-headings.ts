// Where a note's Markdown has a heading of the journal's own levels, as Foundry renders it:
// showdown 2.1.0 with Foundry's options (round 0.34.0 §2.10). A chapter is a level 1 heading in
// Foundry's journal and a note a level 2, so a note's text may hold neither. This only points at
// the lines, for the editor's hint and a refusal's words, and it never refuses a note itself: the
// server renders the note and refuses it only where the HTML holds an h1 or an h2. Pure, so the
// editor can run it as the player types.
//
// It follows showdown's own order of work, on lines rather than on text: fenced code first, then
// (at the top only) raw HTML blocks, then within each block quotes, the under-ruled headings (=
// before -), the # headings, rules and lists, quotes and lists in turn worked through again on
// what they hold. Where it can't tell, it errs towards a line: a false alarm costs a hint the
// player can ignore, a miss costs only a line number.

/** A line, or what showdown made of one: its text, and its number in the note, from 1. */
type Row = { text: string; line: number }

/**
 * What showdown leaves of a block it has dealt with: a line of its own between blank lines, which
 * nothing after reads as a heading. Not a character a note can hold, as a note's text is.
 */
const HASH = '\u0000'
const BLANK: Row = { text: '', line: 0 }
const HASHED: Row[] = [BLANK, { text: HASH, line: 0 }, BLANK]

/** A fenced code block's opening line: up to 3 spaces, ``` or ~~~, and a language at most. */
const FENCE = /^ {0,3}(`{3,}|~{3,}) *[^\s`~]*$/

/** A block quote's first line: up to 3 spaces, >, and anything at all after it. */
const QUOTE = /^ {0,3}>.+/

/** A list item's first line, and its marker, as showdown reads them. */
const ITEM = /^( {0,3})([*+-]|\d+\.)[ \t]+/

/** A rule: three or more -, * or _, spaced or not. */
const RULE = [
  /^ {0,2}( ?-){3,}[ \t]*$/,
  /^ {0,2}( ?\*){3,}[ \t]*$/,
  /^ {0,2}( ?_){3,}[ \t]*$/,
]

/** The HTML blocks showdown keeps as they are, in the order it looks for them. */
const BLOCK_TAGS = [
  'pre',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'table',
  'dl',
  'ol',
  'ul',
  'script',
  'noscript',
  'form',
  'fieldset',
  'iframe',
  'math',
  'style',
  'section',
  'header',
  'footer',
  'nav',
  'article',
  'aside',
  'address',
  'audio',
  'canvas',
  'figure',
  'hgroup',
  'output',
  'video',
  'p',
]

/**
 * The lines of a note's Markdown, from 1, that showdown with Foundry's options makes an H1 or an
 * H2: a line starting # or ## (with or without a space, inside > quotes too), or a line under-ruled
 * with = or - (an H2 even with one -). Fenced code is skipped. As showdown 2.1.0 parses them.
 */
export function bigHeadings(markdown: string): number[] {
  const rows = toRows(markdown)
  const found = new Set<number>()
  // Once as showdown reads raw HTML blocks, which it leaves as they are; and once as if it read
  // them as Markdown, so that a heading inside one is still pointed at: Foundry's editor may show
  // it so, and the render, which decides, says otherwise where it isn't one.
  blockGamut(htmlBlocks(fences(rows)), found)
  blockGamut(fences(rows), found)
  return [...found].filter(line => line > 0).toSorted((a, b) => a - b)
}

/**
 * The note's lines as showdown starts on them: its line breaks made one, its tabs four spaces and
 * a no-break space the entity it becomes, and lines of only spaces made empty.
 */
function toRows(markdown: string): Row[] {
  return markdown
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((text, index) => {
      const row = text
        .replaceAll('\t', ' '.repeat(4))
        .replaceAll('\u00A0', '&nbsp;')
      return { text: /^[ \t]+$/.test(row) ? '' : row, line: index + 1 }
    })
}

/**
 * Fenced code made blocks of their own: from an opening line to the first line at least two after
 * it that starts with the same fence, as showdown's lazy match finds it. Whatever follows the
 * closing fence on its line starts a line of its own after it, as showdown leaves it.
 */
function fences(rows: Row[]): Row[] {
  const out: Row[] = []
  let index = 0
  while (index < rows.length) {
    const fence = FENCE.exec(rows[index].text)?.[1]
    const close = fence === undefined ? -1 : closing(rows, index + 2, fence)
    if (fence === undefined || close === -1) {
      out.push(rows[index])
      index++
      continue
    }
    out.push(...HASHED)
    const { text, line } = rows[close]
    const rest = text.slice(text.indexOf(fence) + fence.length)
    if (rest) out.push({ text: rest, line })
    index = close + 1
  }
  return out
}

/** The first line from this one on that closes the fence, or -1: one that starts with it. */
function closing(rows: Row[], from: number, fence: string): number {
  const closer = new RegExp(`^ {0,3}${fence}`)
  for (let index = from; index < rows.length; index++) {
    if (closer.test(rows[index].text)) return index
  }
  return -1
}

/**
 * Raw HTML blocks set aside, as showdown does before reading any Markdown: for each block tag in
 * its order, from its first opening at a line's start, the first balanced opening and closing of
 * it, again until none is left.
 */
function htmlBlocks(rows: Row[]): Row[] {
  let out = rows
  if (!out.some(({ text }) => /^ {0,3}</.test(text))) return out
  for (const tag of BLOCK_TAGS) {
    // An opening tag may run over lines, as showdown reads the whole text.
    const start = new RegExp(String.raw`^ {0,3}<${tag}\b[^>]*>`, 'im')
    for (;;) {
      const offset = out
        .map(({ text }) => text)
        .join('\n')
        .search(start)
      if (offset === -1) break
      const first = rowAtOffset(out, offset)
      const replaced = hashBalanced(out.slice(first), tag)
      if (!replaced) break
      out = [...out.slice(0, first), ...replaced]
    }
  }
  return out
}

/** The line a place in the lines joined by line breaks is on. */
function rowAtOffset(rows: Row[], offset: number): number {
  let at = 0
  for (const [index, { text }] of rows.entries()) {
    at += text.length + 1
    if (offset < at) return index
  }
  return rows.length - 1
}

/**
 * The lines with the first balanced pair of this tag set aside, as showdown's recursive match
 * finds it from the first line; or undefined where there's none.
 */
function hashBalanced(rows: Row[], tag: string): Row[] | undefined {
  const text = rows.map(row => row.text).join('\n')
  const found = balanced(text, String.raw`<${tag}\b[^>]*>`, `</${tag}>`)
  if (!found) return
  // What's left of the lines the tags are on keeps their numbers.
  const before = rowAtOffset(rows, found.start)
  const after = rowAtOffset(rows, found.end)
  const lineStart = (index: number) =>
    rows.slice(0, index).reduce((at, row) => at + row.text.length + 1, 0)
  const head = text.slice(lineStart(before), found.start)
  const tail = text.slice(found.end, lineStart(after) + rows[after].text.length)
  return [
    ...rows.slice(0, before),
    { text: head, line: rows[before].line },
    ...HASHED,
    { text: tail, line: rows[after].line },
    ...rows.slice(after + 1),
  ]
}

/**
 * The first balanced opening and closing of a tag in the text, nested ones counted, as showdown's
 * `rgxFindMatchPos` finds it: where an opening is never closed, it tries again from the next one.
 */
function balanced(
  text: string,
  left: string,
  right: string,
): { start: number; end: number } | undefined {
  const either = new RegExp(`${left}|${right}`, 'gim')
  const opening = new RegExp(left, 'im')
  let from = 0
  for (;;) {
    either.lastIndex = from
    let depth = 0
    let start = 0
    let resume = 0
    let match: RegExpExecArray | null
    while ((match = either.exec(text))) {
      if (opening.test(match[0])) {
        if (depth++ === 0) {
          resume = either.lastIndex
          start = resume - match[0].length
        }
      } else if (depth > 0 && --depth === 0) {
        return { start, end: match.index + match[0].length }
      }
    }
    if (depth === 0) return
    from = resume
  }
}

/**
 * What showdown does with a block of Markdown, as far as headings go: quotes first, then the
 * headings themselves, then rules and lists.
 */
function blockGamut(rows: Row[], found: Set<number>): void {
  const unquoted = quotes(rows, found)
  const headed = headers(unquoted, found)
  lists(
    headed.flatMap(row =>
      RULE.some(rule => rule.test(row.text)) ? HASHED : [row],
    ),
    found,
  )
}

/**
 * Block quotes, each read again as a block of its own once a level of > is taken from each of its
 * lines: from a line starting with > and anything after it, through the lines that follow it
 * unbroken, and on past blank lines while another such line follows.
 */
function quotes(rows: Row[], found: Set<number>): Row[] {
  const out: Row[] = []
  let index = 0
  while (index < rows.length) {
    if (!QUOTE.test(rows[index].text)) {
      out.push(rows[index])
      index++
      continue
    }
    const quote: Row[] = []
    do {
      quote.push(rows[index++])
      while (index < rows.length && rows[index].text !== '') {
        quote.push(rows[index++])
      }
      while (index < rows.length && rows[index].text === '') {
        quote.push(rows[index++])
      }
    } while (index < rows.length && QUOTE.test(rows[index].text))
    const inner = quote.map(({ text, line }) => {
      const unquoted = text.replace(/^[ \t]*>[ \t]?/, '')
      return { text: /^[ \t]+$/.test(unquoted) ? '' : unquoted, line }
    })
    blockGamut(fences(inner), found)
    out.push(...HASHED)
  }
  return out
}

/**
 * The headings of a block: those under-ruled with =, then those under-ruled with -, each taking
 * its two lines, then those starting with #. Only levels 1 and 2 are noted; every heading is set
 * aside, as showdown sets it aside from what follows.
 */
function headers(rows: Row[], found: Set<number>): Row[] {
  const ruled = underRuled(
    underRuled(rows, /^=+[ \t]*$/, found),
    /^-+[ \t]*$/,
    found,
  )
  return ruled.flatMap(row => {
    const level = hashLevel(row.text)
    if (level === undefined) return [row]
    if (level <= 2) found.add(row.line)
    return HASHED
  })
}

/** Under-ruled headings: a line with anything on it, and under it a line of only this rule. */
function underRuled(rows: Row[], rule: RegExp, found: Set<number>): Row[] {
  const out: Row[] = []
  for (let index = 0; index < rows.length; index++) {
    const { text, line } = rows[index]
    const next = rows[index + 1]
    if (text !== '' && text !== HASH && next && rule.test(next.text)) {
      found.add(line)
      out.push(...HASHED)
      index++
    } else {
      out.push(rows[index])
    }
  }
  return out
}

/**
 * The level of a # heading, as showdown's pattern matches one: as many #, to six, as start the
 * line, where anything follows them; a line of only # is one level fewer, as its last # is its
 * text, and a lone # is no heading.
 */
function hashLevel(text: string): number | undefined {
  const count = /^#+/.exec(text)?.[0].length
  if (!count) return
  if (count > 6) return 6
  if (text.length > count) return count
  return count > 1 ? count - 1 : undefined
}

/**
 * Lists, whose items showdown reads again as blocks where a blank line sets them apart: an item
 * with a blank line in it or after it before the next, or two before it. Other items are read
 * only for lists inside them.
 */
function lists(rows: Row[], found: Set<number>): void {
  let index = 0
  while (index < rows.length) {
    const marker = ITEM.exec(rows[index].text)
    if (!marker) {
      index++
      continue
    }
    const end = listEnd(rows, index)
    const indent = marker[1]
    let item = index
    let blanksBefore = 0
    while (item < end) {
      let next = item + 1
      while (next < end && !startsItem(rows[next].text, indent)) next++
      // The blank lines just before the next item are this item's, as showdown takes one.
      let last = next
      while (last > item + 1 && rows[last - 1].text === '') last--
      const trailing = next - last
      const content = itemRows(rows.slice(item, next < end ? next : last))
      const inner = rows.slice(item + 1, last).some(({ text }) => text === '')
      const block = inner || (next < end && trailing > 0) || blanksBefore >= 2
      if (block) blockGamut(fences(content), found)
      else lists(content, found)
      blanksBefore = trailing
      item = next
    }
    index = end
  }
}

/**
 * Where a list ends: at blank lines followed by a line that starts with neither a space nor an
 * item's marker, or at the block's end.
 */
function listEnd(rows: Row[], from: number): number {
  let index = from + 1
  while (index < rows.length) {
    if (rows[index].text !== '') {
      index++
      continue
    }
    let next = index
    while (next < rows.length && rows[next].text === '') next++
    if (next >= rows.length) return next
    const text = rows[next].text
    if (!/^[ \t]/.test(text) && !ITEM.test(text)) return index
    index = next
  }
  return index
}

/** Whether a line starts another item of a list whose items are indented so. */
function startsItem(text: string, indent: string): boolean {
  const marker = ITEM.exec(text)
  return !!marker && marker[1] === indent
}

/**
 * An item's lines as showdown reads them: its first without its marker, the rest each a level, up
 * to four spaces, less indented. One that starts with a marker of its own is only its text.
 */
function itemRows(rows: Row[]): Row[] {
  const [first, ...rest] = rows
  const text = first.text.replace(ITEM, '')
  return [
    {
      text: /^([*+-]|\d\.)[ \t]+/.test(text) ? `${HASH}${text}` : text,
      line: first.line,
    },
    ...rest.map(({ text, line }) => ({
      text: text.replace(/^ {1,4}/, ''),
      line,
    })),
  ]
}
