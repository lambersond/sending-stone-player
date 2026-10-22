/**
 * @jest-environment node
 */
import {
  convertNoteMarkdown,
  enrichNoteHtml,
  FOUNDRY_SHOWDOWN,
  hasBigHeading,
  renderNoteMarkdown,
} from './note-markdown'

describe('lib/note-markdown', () => {
  it('renders as Foundry does: tables, strikethrough, sized images and fenced code', () => {
    expect(FOUNDRY_SHOWDOWN).toEqual({
      disableForced4SpacesIndentedSublists: true,
      noHeaderId: true,
      parseImgDimensions: true,
      strikethrough: true,
      tables: true,
      tablesHeaderId: true,
    })
    const html = renderNoteMarkdown(
      [
        '| Who | What |',
        '|---|---|',
        '| Vex | rope |',
        '',
        '~~gone~~',
        '',
        '![map](worlds/erebor/map.webp =100x50)',
        '',
        '```',
        '# not a heading',
        '```',
        '',
        '### Loot',
      ].join('\n'),
    )

    expect(html).toContain('<table>')
    expect(html).toMatch(/<td[^>]*>Vex<\/td>/)
    expect(html).toContain('<del>gone</del>')
    expect(html).toContain('width="100"')
    expect(html).toContain('height="50"')
    expect(html).toContain('<pre><code># not a heading')
    // No ids on headings, as Foundry gives none.
    expect(html).toContain('<h3>Loot</h3>')
  })

  it('shows Foundry’s links as their labels, in bold, never as links', () => {
    const html = renderNoteMarkdown(
      'Met @UUID[Actor.vex]{Vex} and @Actor[thorin] at @UUID[Scene.abc.Tile.erebor].',
    )

    expect(html).toBe(
      '<p>Met <strong>Vex</strong> and <strong>thorin</strong> at <strong>erebor</strong>.</p>',
    )
  })

  it('shows rolls as their labels, or their formulas, in bold', () => {
    const html = renderNoteMarkdown(
      'Hit [[/r 1d20+5]], for [[/roll 2d6]]{damage}, or [[1d4]] more.',
    )

    expect(html).toBe(
      '<p>Hit <strong>1d20+5</strong>, for <strong>damage</strong>, or <strong>1d4</strong> more.</p>',
    )
  })

  it('escapes what a label or formula holds, so that it reads as nothing but text', () => {
    const html = renderNoteMarkdown(
      '@UUID[Actor.x]{<img src=x onerror="alert(1)">} and [[/r 2*3]]{*not em*}',
    )

    expect(html).not.toContain('<img')
    expect(html).not.toContain('<em>')
    expect(html).toContain('&lt;img')
  })

  it('leaves Foundry’s links as they are in code: fenced, indented and in backticks', () => {
    const html = renderNoteMarkdown(
      [
        '```',
        '@UUID[Actor.vex]{Vex}',
        '```',
        '',
        '    [[/r 1d20]]',
        '',
        'Type `@UUID[Actor.vex]{Vex}` to link.',
      ].join('\n'),
    )

    expect(html).not.toContain('<strong>')
    expect(html).toContain('@UUID[Actor.vex]{Vex}')
    expect(html).toContain('[[/r 1d20]]')
  })

  it('converts with nothing else done, for the heading rule to read', () => {
    expect(convertNoteMarkdown('@UUID[Actor.vex]{Vex}')).toBe(
      '<p>@UUID[Actor.vex]{Vex}</p>',
    )
  })

  describe('hasBigHeading', () => {
    it.each([
      ['an h1', '<h1>a</h1>', true],
      ['an h2 with attributes', '<h2 class="x">a</h2>', true],
      ['an H1 in capitals', '<H1>a</H1>', true],
      ['only an h3', '<h3>a</h3>', false],
      ['an h1 in a comment', '<!-- <h1>a</h1> -->', false],
      ['an h1 as text', '<p>&lt;h1&gt;a&lt;/h1&gt;</p>', false],
      ['an h1 in an attribute', '<img alt="<h1>">', false],
    ])('%s', (_name, html, big) => {
      expect(hasBigHeading(html)).toBe(big)
    })

    it('reads a raw HTML block holding a # line, which showdown leaves as text, as none', () => {
      expect(hasBigHeading(convertNoteMarkdown('<div>\n#x\n</div>'))).toBe(
        false,
      )
      expect(hasBigHeading(convertNoteMarkdown('#loot'))).toBe(true)
      expect(hasBigHeading(convertNoteMarkdown('Title\n-'))).toBe(true)
    })
  })

  describe('enrichNoteHtml, for Foundry’s own editor', () => {
    it('shows Foundry’s links in its text as their labels, keeping its markup', () => {
      expect(
        enrichNoteHtml(
          '<p class="x">Met @UUID[Actor.vex]{Vex &amp; Co} for [[/r 1d6]].</p>',
        ),
      ).toBe(
        '<p class="x">Met <strong>Vex &amp; Co</strong> for <strong>1d6</strong>.</p>',
      )
    })

    it('leaves code and preformatted text alone, and drops comments', () => {
      expect(
        enrichNoteHtml(
          '<pre><code>@UUID[Actor.vex]{Vex}</code></pre><!-- @UUID[a]{b} --><code>[[1d4]]</code>',
        ),
      ).toBe(
        '<pre><code>@UUID[Actor.vex]{Vex}</code></pre><code>[[1d4]]</code>',
      )
    })
  })
})
