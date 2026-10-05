import { sanitizeSheetHtml } from './sheet-html'

const GAME = 'https://lonely-mountain.forge-vtt.com'
const clean = (html: string) => sanitizeSheetHtml(html, GAME)

describe('lib/sheet-html', () => {
  it('keeps formatting, lists and tables', () => {
    const html =
      '<h3>Second Wind</h3><p>You have a <strong>limited</strong> well of <em>stamina</em>.</p>' +
      '<ul><li>One</li></ul><table><tr><th colspan="2">Level</th></tr><tr><td>1</td><td>d10</td></tr></table>'

    expect(clean(html)).toBe(html)
  })

  it('turns links to Foundry documents and rolls into plain spans', () => {
    expect(
      clean(
        '<p>See <a class="content-link" draggable="true" data-uuid="Compendium.dnd5e.rules.x" data-tooltip="Poisoned"><i class="fas fa-book-open"></i>Poisoned</a>.</p>',
      ),
    ).toBe('<p>See <span class="ref">Poisoned</span>.</p>')
    expect(
      clean(
        '<p>Regain <a class="inline-roll roll" data-mode="roll" data-formula="1d10 + 5"><i class="fas fa-dice-d20"></i>1d10 + 5</a> hit points.</p>',
      ),
    ).toBe(
      '<p>Regain <span class="roll" data-formula="1d10 + 5">1d10 + 5</span> hit points.</p>',
    )
    expect(
      clean(
        '<span class="roll-link-group" data-type="damage"><a class="roll-link"><i class="fa-solid fa-dice-d20"></i>2d6</a> fire</span>',
      ),
    ).toBe('<span><span class="roll">2d6</span> fire</span>')
  })

  it('keeps a secret, which the character’s player may read in Foundry', () => {
    expect(
      clean('<section class="secret" id="secret-1"><p>Hidden</p></section>'),
    ).toBe('<section class="secret"><p>Hidden</p></section>')
  })

  it('points images and links at the game, and opens links in a new tab', () => {
    expect(
      clean(
        '<p><img src="worlds/erebor/map.webp" alt="Map" style="width:9px" onerror="alert(1)"></p>',
      ),
    ).toBe(`<p><img alt="Map" src="${GAME}/worlds/erebor/map.webp" /></p>`)
    expect(clean('<a href="https://example.com/rules">Rules</a>')).toBe(
      '<a href="https://example.com/rules" target="_blank" rel="noopener noreferrer nofollow">Rules</a>',
    )
    expect(clean('<a href="/journal">Journal</a>')).toBe(
      `<a href="${GAME}/journal" target="_blank" rel="noopener noreferrer nofollow">Journal</a>`,
    )
  })

  it.each([
    ['a script', '<p>Hi</p><script>alert(1)</script>', '<p>Hi</p>'],
    ['an event handler', '<p onclick="alert(1)">Hi</p>', '<p>Hi</p>'],
    ['a style', '<p style="color:red">Hi</p>', '<p>Hi</p>'],
    [
      'a javascript: link',
      '<a href="javascript:alert(1)">Hi</a>',
      '<span>Hi</span>',
    ],
    ['a data: image', '<img src="data:image/png;base64,AAAA">', ''],
    ['an iframe', '<iframe src="https://example.com"></iframe>', ''],
    [
      'a class this app does not use',
      '<span class="evil roll">2d6</span>',
      '<span class="roll">2d6</span>',
    ],
  ])('strips %s', (_, html, expected) => {
    expect(clean(html)).toBe(expected)
  })
})
