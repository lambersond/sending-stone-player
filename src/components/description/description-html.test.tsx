import { render, screen } from '@testing-library/react'
import {
  drawDescription,
  readDescription,
  type DrawLink,
  type LinkPart,
} from './description-html'

/** A description drawn, its links drawn as buttons saying what they are; and those drawn. */
const draw = (html: string, drawLink?: DrawLink) => {
  const body = readDescription(html)
  if (!body) throw new Error('No DOMParser')
  const { container } = render(
    <div data-testid='text'>{drawDescription(body, drawLink)}</div>,
  )
  return container.firstElementChild as HTMLElement
}

/** Draws each link as a button named for what it is, keeping each part it was given. */
const buttons = () => {
  const parts: LinkPart[] = []
  const drawLink: DrawLink = part => {
    parts.push(part)
    return (
      <button type='button'>
        {part.link.kind}: {part.label}
      </button>
    )
  }
  return { parts, drawLink }
}

describe('components/character-sheet/description-html', () => {
  let errors: jest.SpyInstance
  beforeEach(() => {
    errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    // React warns of what it can't draw, such as text between a table's rows.
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('draws formatting, lists and tables as the server kept them, without the spaces between rows', () => {
    const text = draw(
      `<h3>Second Wind</h3><p>Regain <strong>1d10</strong> <em>hit</em> points.<br>Once.</p>
       <ul><li>One</li><li>Two</li></ul>
       <table>
         <caption>Damage</caption>
         <thead> <tr> <th scope="col">d6</th> <th scope="bogus">Effect</th> </tr> </thead>
         <tbody> <tr> <td colspan="2">Fire</td> </tr> <tr><td rowspan="0">x</td><td colspan="5000">y</td></tr> </tbody>
       </table><hr>`,
    )

    expect(screen.getByRole('heading', { name: 'Second Wind' })).toBeVisible()
    expect(text.querySelector('p')?.innerHTML).toBe(
      'Regain <strong>1d10</strong> <em>hit</em> points.<br>Once.',
    )
    expect(
      screen.getAllByRole('listitem').map(item => item.textContent),
    ).toEqual(['One', 'Two'])
    expect(screen.getByRole('table', { name: 'Damage' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'd6' })).toHaveAttribute(
      'scope',
      'col',
    )
    expect(
      screen.getByRole('columnheader', { name: 'Effect' }),
    ).not.toHaveAttribute('scope')
    expect(screen.getByRole('cell', { name: 'Fire' })).toHaveAttribute(
      'colspan',
      '2',
    )
    // A span the browser wouldn't take, or that's out of reason, is left out.
    expect(screen.getByRole('cell', { name: 'x' })).not.toHaveAttribute(
      'rowspan',
    )
    expect(screen.getByRole('cell', { name: 'y' })).not.toHaveAttribute(
      'colspan',
    )
    expect(text.querySelector('tbody')?.childNodes).toHaveLength(2)
    expect(text.querySelector('hr')).not.toBeNull()
  })

  it('keeps links to web and email addresses, opening apart, and nothing else of theirs', () => {
    const text = draw(
      `<p><a href="https://example.com/map" target="_self" rel="opener" id="x" class="evil" style="color:red" onclick="alert(1)">map</a>
       <a href="mailto:dm@example.com">mail</a>
       <a href="javascript:alert(1)">script</a>
       <a href="/relative">relative</a>
       <a>nowhere</a></p>`,
    )

    const map = screen.getByRole('link', { name: 'map' })
    expect(
      Object.fromEntries(
        [...map.attributes].map(({ name, value }) => [name, value]),
      ),
    ).toEqual({
      href: 'https://example.com/map',
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    })
    expect(screen.getByRole('link', { name: 'mail' })).toHaveAttribute(
      'href',
      'mailto:dm@example.com',
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
    for (const name of ['script', 'relative', 'nowhere']) {
      expect(screen.getByText(name).tagName).toBe('SPAN')
    }
    expect(text.innerHTML).not.toMatch(/onclick|style|javascript|evil/)
  })

  it('keeps images from web addresses, with their text and size, and nothing else', () => {
    draw(
      `<p><img src="https://my-game.example/map.webp" alt="The map" width="200" height="huge" onerror="alert(1)" style="x">
       <img src="data:image/png;base64,AAAA" alt="inline">
       <img src="javascript:alert(1)" alt="script">
       <img alt="none"></p>`,
    )

    const map = screen.getByRole('img', { name: 'The map' })
    expect(
      Object.fromEntries(
        [...map.attributes].map(({ name, value }) => [name, value]),
      ),
    ).toEqual({
      src: 'https://my-game.example/map.webp',
      alt: 'The map',
      width: '200',
    })
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('leaves out what is no text to read, with its content, and any tag it doesn’t draw, but not its text', () => {
    const text = draw(
      `<p>Before<script>alert(1)</script><style>p{}</style><iframe src="https://evil.example">frame</iframe><svg><text>drawn</text></svg><textarea>typed</textarea><select><option>picked</option></select></p>
       <p><font color="red">Red</font> <button onclick="alert(1)">Pressed</button> <input value="x"> <details open><summary>Summary</summary>Folded</details></p>
       <div id="main" class="layout" style="color:red" data-x="1">Kept</div>`,
    )

    expect(text.textContent).toMatch(
      /^Before\s+Red Pressed {2}SummaryFolded\s+Kept$/,
    )
    expect(
      text.querySelectorAll(
        'script, style, iframe, svg, textarea, select, font, button, input, details, summary',
      ),
    ).toHaveLength(0)
    expect(text.querySelector('div')?.attributes).toHaveLength(0)
  })

  it('draws a roll the page can’t act on as plain text, a reference in bold, and a secret as one', () => {
    const text = draw(
      `<p>Regain <span class="roll" data-formula="1d10 + 5">1d10 + 5</span> from <span class="ref">Second Wind</span>.</p>
       <section class="secret other"><p>The Gamemaster’s</p></section>`,
    )

    expect(screen.getByText('1d10 + 5')).not.toHaveClass('roll')
    expect(screen.getByText('1d10 + 5').attributes).toHaveLength(0)
    expect(screen.getByText('Second Wind')).toHaveClass('ref')
    expect(text.querySelector('section')?.className).toBe('secret')
  })

  it('draws each link the game acts on as it’s told, from what it means and its text alone, in a secret or not', () => {
    const { parts, drawLink } = buttons()
    draw(
      `<p>Make a <span class="ss-save roll" data-n="0" data-ability="dex" data-dc="15">DC 15 <b>Dexterity</b></span> saving throw,
       taking <span class="ss-damage roll" data-n="1" data-formulas="2d6&amp;1d4" data-types="fire&amp;cold|acid">2d6 fire</span>,
       or <span class="ss-roll roll" data-n="2" data-formula="1d4">1d4</span>, and is <span class="ss-condition ref" data-condition="prone">Prone</span>.</p>
       <section class="secret"><p><span class="ss-save roll" data-n="3" data-ability="str|dex">Strength or Dexterity</span></p></section>`,
      drawLink,
    )

    expect(
      screen.getAllByRole('button').map(button => button.textContent),
    ).toEqual([
      'save: DC 15 Dexterity',
      'damage: 2d6 fire',
      'roll: 1d4',
      'condition: Prone',
      'save: Strength or Dexterity',
    ])
    expect(parts.map(({ link, secret }) => ({ link, secret }))).toEqual([
      {
        link: {
          kind: 'save',
          n: 0,
          abilities: ['dex'],
          dc: 15,
          concentration: false,
        },
        secret: false,
      },
      {
        link: {
          kind: 'damage',
          n: 1,
          parts: [
            { formula: '2d6', types: ['fire'] },
            { formula: '1d4', types: ['cold', 'acid'] },
          ],
          healing: false,
        },
        secret: false,
      },
      { link: { kind: 'roll', n: 2, formula: '1d4' }, secret: false },
      { link: { kind: 'condition', condition: 'prone' }, secret: false },
      {
        link: {
          kind: 'save',
          n: 3,
          abilities: ['str', 'dex'],
          concentration: false,
        },
        secret: true,
      },
    ])
  })

  it('never draws a link inside another, or inside a web link, or twice by its number, or one that doesn’t hold up', () => {
    const { parts, drawLink } = buttons()
    const text = draw(
      `<p><span class="ss-damage roll" data-n="0" data-formulas="2d6"><button>Evil</button> 2d6 <span class="ss-roll" data-n="1" data-formula="1d4">1d4</span> <a href="https://example.com">site</a></span></p>
       <p><a href="https://example.com"><span class="ss-roll roll" data-n="2" data-formula="1d8">1d8</span></a></p>
       <p><span class="ss-roll roll" data-n="0" data-formula="1d12">again</span></p>
       <p><span class="ss-save roll" data-n="4" data-ability="constructor">forged</span>
       <span class="ss-roll roll" data-n="5" data-formula="@mod">unread</span>
       <span class="ss-save roll" data-ability="dex">unnumbered</span>
       <span class="ss-condition ref" data-condition="Prone!">shouting</span></p>`,
      drawLink,
    )

    // The outer link, labelled with its text alone, and nothing inside it drawn.
    expect(parts.map(({ label }) => label)).toEqual(['Evil 2d6 1d4 site'])
    expect(screen.getAllByRole('button')).toHaveLength(1)
    // Inside a web link, it's only text.
    expect(screen.getByRole('link', { name: '1d8' })).toBeVisible()
    // The rest are their text, a reference still bold.
    for (const each of ['again', 'forged', 'unread', 'unnumbered']) {
      expect(screen.getByText(each)).not.toHaveClass('roll')
    }
    expect(screen.getByText('shouting')).toHaveClass('ref')
    expect(text.querySelectorAll('[class^="ss-"], [data-n]')).toHaveLength(0)
  })

  it('draws every link as its text where nothing says what links do', () => {
    draw(
      '<p><span class="ss-save roll" data-n="0" data-ability="dex">DC 15 Dexterity</span> and <span class="ss-condition ref" data-condition="prone">Prone</span></p>',
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('DC 15 Dexterity')).not.toHaveClass('roll')
    expect(screen.getByText('Prone')).toHaveClass('ref')
  })

  it('reads nothing where there is no browser to read with, as on the server', () => {
    const parser = globalThis.DOMParser
    Reflect.deleteProperty(globalThis, 'DOMParser')
    try {
      expect(readDescription('<p>Text</p>')).toBeUndefined()
    } finally {
      globalThis.DOMParser = parser
    }
  })
})
