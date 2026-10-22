/**
 * @jest-environment node
 */
import showdown from 'showdown'
import { bigHeadings } from './note-headings'
import { FOUNDRY_SHOWDOWN } from '@/lib/note-markdown'

// The scanner is checked against showdown itself, with Foundry's options, as the server renders a
// note: it only points at lines, and the render decides, so it may raise a false alarm but should
// never miss a heading the render finds.

const converter = new showdown.Converter(FOUNDRY_SHOWDOWN)

/** How many H1s and H2s showdown makes of the Markdown. */
const rendered = (markdown: string) =>
  (converter.makeHtml(markdown).match(/<h[12][\s>]/g) ?? []).length

describe('utils/note-headings', () => {
  describe('bigHeadings, against showdown with Foundry’s options', () => {
    it.each<[string, string, number[]]>([
      ['# with no space', '#a', [1]],
      ['# with a space', '# a', [1]],
      ['## with no space', '##a', [1]],
      ['## with a space', '## a', [1]],
      ['### with no space', '###a', []],
      ['### with a space', '### a', []],
      ['a # put after a backslash', String.raw`\#a`, []],
      ['a # after a space', ' #a', []],
      ['a # in indented code', '    #a', []],
      ['a # in ``` code', '```\n# a\n```', []],
      ['a ## in ~~~ code', '~~~\n## a\n~~~', []],
      ['a # in a quote', '> # a', [1]],
      ['a ## two quotes in', '>> ## a', [1]],
      ['a # right after >', '>#a', [1]],
      ['a # two spaces after >', '>  # a', []],
      ['a line under-ruled with =', 'a\n=', [1]],
      ['a line under-ruled with ===', 'a\n===', [1]],
      ['a line under-ruled with one -', 'a\n-', [1]],
      ['a line under-ruled with ---', 'a\n---', [1]],
      ['a rule after a blank line', 'a\n\n---', []],
      ['a list item', '- a', []],
      ['a rule of stars', '* * *', []],
      ['a table', '| a | b |\n|---|---|\n| 1 | 2 |', []],
      ['## alone, whose last # is its text', '##', [1]],
      ['### alone, an H2 for the same reason', '###', [1]],
      ['# alone, no heading', '#', []],
      ['#### alone, an H3', '####', []],
      ['seven #, an H6', '#######', []],
      ['the second line of a paragraph under-ruled', 'one\ntwo\n-', [2]],
      ['a rule taken by the line above, then a lone =', 'a\n=\n=', [1]],
      ['a ### line under-ruled', '### fine\n-', [1]],
      ['a quote under-ruled, its line lazily in it', '> x\n-', [1]],
      ['a rule in a quote under a line outside it', 'x\n> -', []],
      ['text after a closing fence', '```\nx\n```#a', [3]],
      ['a # after a blank line', 'text\n\n#tag at the start', [3]],
      ['a # in a tight list item', '- #tag', []],
      ['a # in a list item a blank line sets apart', '- #tag\n\n- b', [1]],
      ['an indented line under-ruled', '    code\n=', [1]],
      ['a rule after a space', 'a\n -', []],
      ['# and a tab', '#\ta', [1]],
      ['a title under-ruled', 'Title\n-', [1]],
      ['a heading two lines into a note', 'Loot:\n#loot', [2]],
    ])('%s', (_name, markdown, lines) => {
      expect(bigHeadings(markdown)).toEqual(lines)
      expect(rendered(markdown) > 0).toBe(lines.length > 0)
      expect(rendered(markdown)).toBe(lines.length)
    })

    it('points at a # inside a raw HTML block, which showdown leaves as text: a hint only', () => {
      const markdown = '<div>\n#x\n</div>'

      expect(bigHeadings(markdown)).toEqual([2])
      expect(rendered(markdown)).toBe(0)
    })

    it('reads line breaks of every kind, and none for an empty note', () => {
      expect(bigHeadings('a\r\n=\r\n\r\n#b')).toEqual([1, 4])
      expect(bigHeadings('a\r-')).toEqual([1])
      expect(bigHeadings('')).toEqual([])
    })

    it('never misses a heading showdown makes of 5,000 notes of the lines that make them', () => {
      const random = seeded(34)
      const kinds = [
        ['#', '#a', '# a', '#tag word'],
        ['##', '##a', '## a'],
        ['###', '### a', '###a'],
        ['=', '===', '= '],
        ['-', '--'],
        ['---', '- - -'],
        ['>', '> a', '>a', '> '],
        ['> #a', '> # a', '> ## a', '>#a', '>> ## a'],
        ['```', '~~~', '```js', '````'],
        ['    code', '    # a', '    ='],
        [''],
        ['word', 'two words', 'some more words here'],
        ['| a | b |', '|---|---|'],
        ['<div>', '</div>'],
      ]
      const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)]
      let agreed = 0
      const missed: string[] = []
      for (let note = 0; note < 5000; note++) {
        const lines = Array.from(
          { length: 1 + Math.floor(random() * 12) },
          () => pick(pick(kinds)),
        )
        const markdown = lines.join('\n')
        const found = bigHeadings(markdown)
        const headings = rendered(markdown)
        if (found.length > 0 === headings > 0) agreed++
        // Each heading the render finds is one line the scanner points at.
        if (found.length < headings) missed.push(markdown)
      }
      // Printed, as the scanner's false alarms are allowed: the render decides.
      // eslint-disable-next-line no-console -- the agreement rate is printed (round 0.34.0 §8.11)
      console.log(`bigHeadings agreed with showdown on ${agreed} of 5000 notes`)
      expect(missed).toEqual([])
      expect(agreed).toBeGreaterThan(4900)
    })
  })
})

/** A seeded random number from 0 to 1 (mulberry32), so a failure can be run again. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = Math.trunc(state + 1_831_565_813) // mulberry32's 0x6d2b79f5
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}
