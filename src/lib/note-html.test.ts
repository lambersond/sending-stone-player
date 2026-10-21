/**
 * @jest-environment node
 */
import { noteHtml, sanitizeNoteHtml } from './note-html'

const GAME = 'https://my-game.forge-vtt.com'
const personal = { secrets: true }
const party = { secrets: false }

describe('lib/note-html', () => {
  it('moves a note’s headings under its entry’s h4: h1-h3 to h5, h4-h6 to h6', () => {
    expect(
      sanitizeNoteHtml(
        '<h1>a</h1><h2>b</h2><h3>c</h3><h4>d</h4><h5>e</h5><h6>f</h6>',
        GAME,
        personal,
      ),
    ).toBe('<h5>a</h5><h5>b</h5><h5>c</h5><h6>d</h6><h6>e</h6><h6>f</h6>')
  })

  it('drops scripts, frames, styles, handlers and script links', () => {
    const html = sanitizeNoteHtml(
      [
        '<script>alert(1)</script>',
        '<iframe src="https://evil.example"></iframe>',
        '<style>p { display: none }</style>',
        '<p onclick="alert(1)" style="color: red">text</p>',
        '<img src="x.png" onerror="alert(1)">',
        '<a href="javascript:alert(1)">click</a>',
      ].join(''),
      GAME,
      personal,
    )

    expect(html).not.toMatch(/script|iframe|style|onclick|onerror|javascript:/i)
    expect(html).toContain('<p>text</p>')
    expect(html).toContain('<span>click</span>')
  })

  it('keeps a personal note’s secrets, as its own character’s', () => {
    expect(
      sanitizeNoteHtml(
        '<section class="secret other"><p>hid</p></section>',
        GAME,
        personal,
      ),
    ).toBe('<section class="secret"><p>hid</p></section>')
  })

  it('removes a party note’s secrets, with everything in them', () => {
    expect(
      sanitizeNoteHtml(
        '<p>shown</p><section class="secret"><p>the <em>traitor</em></p></section>',
        GAME,
        party,
      ),
    ).toBe('<p>shown</p>')
  })

  it('removes a party note’s secrets wherever they sit, and Foundry’s icons', () => {
    const html = sanitizeNoteHtml(
      '<div><p>a</p><section class="other secret"><section><p>deep</p></section></section><p>b <i class="fas fa-dice"></i></p></div>',
      GAME,
      party,
    )

    expect(html).toBe('<div><p>a</p><p>b </p></div>')
  })

  it('drops every class but a secret’s, and every link’s data', () => {
    expect(
      sanitizeNoteHtml(
        '<p class="x"><span class="roll" data-formula="1d20">r</span></p><section class="other">s</section>',
        GAME,
        personal,
      ),
    ).toBe('<p><span>r</span></p><section>s</section>')
  })

  it('points images and links at the game, as Foundry’s relative paths do', () => {
    expect(
      sanitizeNoteHtml(
        '<img src="worlds/erebor/map.webp" alt="map" width="100"><a href="journal/x">x</a>',
        GAME,
        personal,
      ),
    ).toBe(
      `<img alt="map" width="100" src="${GAME}/worlds/erebor/map.webp" /><a href="${GAME}/journal/x" target="_blank" rel="noopener noreferrer nofollow">x</a>`,
    )
  })

  it('makes Foundry’s own links, which only work inside it, their text', () => {
    expect(
      sanitizeNoteHtml(
        '<a class="content-link" data-uuid="Actor.vex">Vex</a><a class="inline-roll" data-formula="1d4">1d4</a>',
        GAME,
        personal,
      ),
    ).toBe('<span>Vex</span><span>1d4</span>')
  })

  describe('noteHtml', () => {
    it('renders Markdown, its secrets kept or removed by its book', () => {
      const body =
        '### Loot\n\n<section class="secret">\n\nthe key\n\n</section>\n\nrope'

      expect(noteHtml({ format: 2, body }, GAME, true)).toContain(
        '<section class="secret">',
      )
      const drawn = noteHtml({ format: 2, body }, GAME, false)
      expect(drawn).toContain('<h5>Loot</h5>')
      expect(drawn).not.toContain('key')
      expect(drawn).toContain('rope')
    })

    it('draws Foundry’s HTML with its links as their labels', () => {
      expect(
        noteHtml(
          { format: 1, body: '<h1>Map</h1><p>@UUID[Actor.vex]{Vex}</p>' },
          GAME,
          true,
        ),
      ).toBe('<h5>Map</h5><p><strong>Vex</strong></p>')
    })
  })
})
