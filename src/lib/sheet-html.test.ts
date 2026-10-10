/**
 * @jest-environment node
 */
import { sanitizeSheetHtml, sheetLinks } from './sheet-html'

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
    ['an image address that is not one', '<img src="https://[bad">', ''],
    ['an iframe', '<iframe src="https://example.com"></iframe>', ''],
    [
      'a class this app does not use',
      '<span class="evil roll">2d6</span>',
      '<span class="roll">2d6</span>',
    ],
  ])('strips %s', (_, html, expected) => {
    expect(clean(html)).toBe(expected)
  })

  describe('links the module marks', () => {
    const save =
      '<span class="ss-save roll" data-n="0" data-ability="dex" data-dc="15">DC 15 Dexterity</span>'
    const damage =
      '<span class="ss-damage roll" data-n="1" data-formulas="2d6&amp;1d4 + 2" data-types="fire&amp;cold|fire">2d6 fire and 1d4 + 2 cold or fire</span>'
    const roll =
      '<span class="ss-roll roll" data-n="2" data-formula="1d6 + 2">1d6 + 2</span>'
    const condition =
      '<span class="ss-condition ref" data-condition="prone">Prone</span>'

    it('keeps each, with what it means', () => {
      const html = `<p>Make a ${save} saving throw, taking ${damage}, ${roll} feet, or fall ${condition}.</p>`

      expect(clean(html)).toBe(html)
    })

    it('keeps a concentration check, one naming no ability, a choice of abilities, healing, and a part with no type', () => {
      const html =
        '<span class="ss-save roll" data-n="0" data-ability="con" data-type="concentration">Concentration</span>' +
        '<span class="ss-save roll" data-n="1" data-ability="str|dex">Strength or Dexterity</span>' +
        '<span class="ss-save roll" data-n="4" data-dc="10" data-type="concentration">Concentration</span>' +
        '<span class="ss-damage roll" data-n="2" data-formulas="2d4 + 2" data-types="healing" data-healing="true">2d4 + 2</span>' +
        '<span class="ss-damage roll" data-n="3" data-formulas="1d6&amp;1d8" data-types="&amp;cold">1d6 and 1d8 cold</span>'

      expect(clean(html)).toBe(html)
    })

    it('keeps a check: an ability, a skill or a tool with its ability, a choice of them, its DC, and a tool a skill is checked using', () => {
      const html =
        '<span class="ss-check roll" data-n="0" data-checks="skill:str:ath" data-dc="15">DC 15 Strength (Athletics)</span>' +
        '<span class="ss-check roll" data-n="1" data-checks="check:int|check:wis">Intelligence or Wisdom</span>' +
        '<span class="ss-check roll" data-n="2" data-checks="skill:str:ath|skill:dex:acr" data-dc="12">DC 12 Strength (Athletics) or Dexterity (Acrobatics)</span>' +
        '<span class="ss-check roll" data-n="3" data-checks="tool:dex:thief" data-dc="15">DC 15 Dexterity (Thieves’ Tools)</span>' +
        '<span class="ss-check roll" data-n="4" data-checks="skill:dex:slt" data-using-tool="thief">Dexterity (Sleight of Hand)</span>'

      expect(clean(html)).toBe(html)
      expect(sheetLinks(clean(html)).size).toBe(5)
    })

    it.each([
      ['an ability dnd5e hasn’t', 'check:hon'],
      ['an ability any object has', 'check:constructor'],
      ['a skill without its ability', 'skill:ath'],
      ['a check with a skill', 'check:str:ath'],
      ['a kind of roll that isn’t a check', 'save:dex'],
      ['a key with more in it', 'skill:str:ath:acr'],
      ['a key that isn’t one', 'tool:dex:thieves tools'],
      ['nothing', ''],
      ['an option left empty', 'check:str|'],
      [
        'more than ten ways',
        Array.from({ length: 11 }, (_, n) => `tool:dex:t${n}`).join('|'),
      ],
    ])('keeps a check naming %s as text', (_name, checks) => {
      expect(
        clean(
          `<span class="ss-check roll" data-n="0" data-checks="${checks}" data-dc="15">x</span>`,
        ),
      ).toBe('<span class="roll">x</span>')
    })

    it('keeps a check, but not a DC or tool it names that doesn’t hold up', () => {
      expect(
        clean(
          '<span class="ss-check roll" data-n="0" data-checks="check:str" data-dc="100" data-using-tool="thieves tools" data-skill="ath" data-ability="dex">x</span>',
        ),
      ).toBe(
        '<span class="ss-check roll" data-n="0" data-checks="check:str">x</span>',
      )
    })

    it('keeps as many links as the module numbers, 0 to 199', () => {
      const html = Array.from(
        { length: 200 },
        (_, n) =>
          `<span class="ss-roll roll" data-n="${n}" data-formula="1d6">1d6</span>`,
      ).join(' ')

      expect(clean(html)).toBe(html)
      expect(sheetLinks(clean(html)).size).toBe(200)
    })

    it('reads values as written, entities and all, and writes them back escaped', () => {
      expect(
        clean(
          '<span class="ss-damage roll" data-n="4" data-formulas="1d6&#38;1d8" data-types="fire&#124;cold&amp;">x</span>',
        ),
      ).toBe(
        '<span class="ss-damage roll" data-n="4" data-formulas="1d6&amp;1d8" data-types="fire|cold&amp;">x</span>',
      )
    })

    it.each([
      ['a number past the last', 'ss-roll', 'data-n="200" data-formula="1d6"'],
      ['a negative number', 'ss-roll', 'data-n="-1" data-formula="1d6"'],
      [
        'a number with a leading 0',
        'ss-roll',
        'data-n="01" data-formula="1d6"',
      ],
      ['no number', 'ss-roll', 'data-formula="1d6"'],
      [
        'a formula with roll data',
        'ss-roll',
        'data-n="0" data-formula="1d6 + @mod"',
      ],
      [
        'roll data written as an entity',
        'ss-roll',
        'data-n="0" data-formula="1d6 + &#64;mod"',
      ],
      [
        'a formula with words',
        'ss-roll',
        'data-n="0" data-formula="1d6 + str"',
      ],
      ['an empty formula', 'ss-roll', 'data-n="0" data-formula=""'],
      [
        'a formula too long',
        'ss-roll',
        `data-n="0" data-formula="${'1+'.repeat(50)}1"`,
      ],
      [
        'eleven parts',
        'ss-damage',
        `data-n="0" data-formulas="${Array.from({ length: 11 }, () => '1d6').join('&amp;')}"`,
      ],
      ['an empty part', 'ss-damage', 'data-n="0" data-formulas="1d6&amp;"'],
      [
        'damage with roll data',
        'ss-damage',
        'data-n="0" data-formulas="1d6 + @mod"',
      ],
      [
        'damage with roll data written as an entity',
        'ss-damage',
        'data-n="0" data-formulas="1d6 + &#64;mod"',
      ],
      [
        'damage with words',
        'ss-damage',
        'data-n="0" data-formulas="1d6 + str"',
      ],
      [
        'roll data in damage’s second part',
        'ss-damage',
        'data-n="0" data-formulas="1d6&amp;@mod"',
      ],
      ['an ability dnd5e lacks', 'ss-save', 'data-n="0" data-ability="luck"'],
      [
        'a name any object answers to',
        'ss-save',
        'data-n="0" data-ability="constructor"',
      ],
      [
        'an ability list ending in a choice',
        'ss-save',
        'data-n="0" data-ability="dex|"',
      ],
      ['no ability', 'ss-save', 'data-n="0" data-dc="15"'],
      ['a condition in capitals', 'ss-condition', 'data-condition="Prone"'],
      ['a condition with a digit', 'ss-condition', 'data-condition="prone1"'],
      ['no condition', 'ss-condition', 'data-n="0"'],
    ])(
      'drops a link with %s, keeping its text and look',
      (_, name, attributes) => {
        const look = name === 'ss-condition' ? 'ref' : 'roll'

        expect(
          clean(`<span class="${name} ${look}" ${attributes}>Text</span>`),
        ).toBe(`<span class="${look}">Text</span>`)
        expect(clean(`<span class="${name}" ${attributes}>Text</span>`)).toBe(
          '<span>Text</span>',
        )
      },
    )

    it.each([
      ['a DC of 0', 'data-dc="0"'],
      ['a DC of 100', 'data-dc="100"'],
      ['a DC with more after it', 'data-dc="15 or 17"'],
      ['another kind of save', 'data-type="check"'],
      ['healing on a save', 'data-healing="true"'],
      ['a formula on a save', 'data-formula="1d6"'],
    ])('keeps a save, but not %s', (_, attribute) => {
      expect(
        clean(
          `<span class="ss-save roll" data-n="0" data-ability="dex" ${attribute}>Dexterity</span>`,
        ),
      ).toBe(
        '<span class="ss-save roll" data-n="0" data-ability="dex">Dexterity</span>',
      )
    })

    it.each([
      ['a type that is not a key', 'fire&amp;<b>cold</b>'],
      ['a type starting with a digit', '1fire'],
      ['eleven choices', Array.from({ length: 11 }, () => 'fire').join('|')],
    ])('keeps damage, but not %s for types', (_, types) => {
      expect(
        clean(
          `<span class="ss-damage roll" data-n="0" data-formulas="1d6" data-types="${types}" data-healing="yes">1d6</span>`,
        ),
      ).toBe(
        '<span class="ss-damage roll" data-n="0" data-formulas="1d6">1d6</span>',
      )
    })

    it('never lets a value out of its attribute, nor keeps anything else on a link', () => {
      const html = clean(
        '<span class="ss-save roll evil" data-n="0" data-ability="dex" data-dc="15&quot; onmouseover=&quot;alert(1)" onclick="alert(1)" style="color:red" id="x" data-uuid="Actor.x" title="t">Dexterity</span>',
      )

      expect(html).toBe(
        '<span class="ss-save roll" data-n="0" data-ability="dex">Dexterity</span>',
      )
    })

    it('keeps one class of link, the first the app knows', () => {
      expect(
        clean(
          '<span class="ss-condition ss-save roll" data-n="0" data-ability="dex" data-condition="prone">x</span>',
        ),
      ).toBe(
        '<span class="ss-save roll" data-n="0" data-ability="dex">x</span>',
      )
    })

    it('keeps only the first link of a number', () => {
      expect(
        clean(
          '<span class="ss-roll roll" data-n="3" data-formula="1d6">1d6</span>' +
            '<span class="ss-save roll" data-n="3" data-ability="dex">Dexterity</span>',
        ),
      ).toBe(
        '<span class="ss-roll roll" data-n="3" data-formula="1d6">1d6</span>' +
          '<span class="roll">Dexterity</span>',
      )
    })

    it('drops a link inside another, or inside a link of any kind, keeping the outer one', () => {
      expect(
        clean(
          `<span class="ss-damage roll" data-n="0" data-formulas="1d6">1d6 ${save} ${condition}</span>`,
        ),
      ).toBe(
        '<span class="ss-damage roll" data-n="0" data-formulas="1d6">1d6 <span class="roll">DC 15 Dexterity</span> <span class="ref">Prone</span></span>',
      )
      expect(clean(`<a href="https://example.com">${roll}</a>`)).toBe(
        '<a href="https://example.com/" target="_blank" rel="noopener noreferrer nofollow"><span class="roll">1d6 + 2</span></a>',
      )
      expect(
        clean(`<a class="content-link" data-uuid="x"><b>${condition}</b></a>`),
      ).toBe('<span class="ref"><b><span class="ref">Prone</span></b></span>')
      // Inside one that doesn't hold up, too.
      expect(
        clean(
          `<span class="ss-roll roll" data-n="0" data-formula="@mod">${roll}</span>`,
        ),
      ).toBe('<span class="roll"><span class="roll">1d6 + 2</span></span>')
    })

    it('keeps a link after another closes, and one in a secret', () => {
      const html = `<p><a href="https://example.com/a">A</a> ${roll}</p><section class="secret"><p>${save}</p></section>`

      expect(clean(html)).toBe(
        `<p><a href="https://example.com/a" target="_blank" rel="noopener noreferrer nofollow">A</a> ${roll}</p><section class="secret"><p>${save}</p></section>`,
      )
    })

    it('keeps a link after markup left open, or closed out of turn', () => {
      expect(clean(`<p><b>Bold</p>${roll}`)).toBe(`<p><b>Bold</b></p>${roll}`)
      expect(clean(`</a></span>${roll}`)).toBe(roll)
    })

    it('marks nothing else as a link', () => {
      expect(
        clean(
          '<div class="ss-save" data-n="0" data-ability="dex">x</div><span data-n="1" data-ability="dex" data-condition="prone">y</span>',
        ),
      ).toBe('<div>x</div><span>y</span>')
      expect(
        clean(
          '<a class="ss-save roll-link" data-n="0" data-ability="dex" data-formula="1d6">x</a>',
        ),
      ).toBe('<span class="roll" data-formula="1d6">x</span>')
    })
  })

  describe('sheetLinks', () => {
    it('reads the links a kept description has, by number, and which are in a secret', () => {
      const html = clean(
        '<p><span class="ss-save roll" data-n="0" data-ability="str|dex" data-dc="15">x</span>' +
          '<span class="ss-condition ref" data-condition="prone">Prone</span></p>' +
          '<section class="secret"><div><span class="ss-damage roll" data-n="1" data-formulas="2d6 + 3&amp;1d4" data-types="fire|cold&amp;" data-healing="true">y</span></div></section>' +
          '<span class="ss-roll roll" data-n="7" data-formula=" 1d6 ">z</span>',
      )

      expect(sheetLinks(html)).toEqual(
        new Map([
          [
            0,
            {
              link: {
                kind: 'save',
                n: 0,
                abilities: ['str', 'dex'],
                dc: 15,
                concentration: false,
              },
              secret: false,
            },
          ],
          [
            1,
            {
              link: {
                kind: 'damage',
                n: 1,
                parts: [
                  { formula: '2d6 + 3', types: ['fire', 'cold'] },
                  { formula: '1d4', types: [] },
                ],
                healing: true,
              },
              secret: true,
            },
          ],
          [7, { link: { kind: 'roll', n: 7, formula: '1d6' }, secret: false }],
        ]),
      )
    })

    it('reads a check, each of its ways once, and whether it’s in a secret', () => {
      const html = clean(
        '<span class="ss-check roll" data-n="0" data-checks="skill:str:ath|skill:dex:ath|tool:dex:thief|check:int" data-dc="15" data-using-tool="thief">x</span>' +
          '<section class="secret"><span class="ss-check roll" data-n="1" data-checks="check:wis">y</span></section>',
      )

      expect(sheetLinks(html)).toEqual(
        new Map([
          [
            0,
            {
              link: {
                kind: 'check',
                n: 0,
                checks: [
                  { type: 'skill', ability: 'str', key: 'ath' },
                  { type: 'tool', ability: 'dex', key: 'thief' },
                  { type: 'check', ability: 'int' },
                ],
                dc: 15,
                usingTool: 'thief',
              },
              secret: false,
            },
          ],
          [
            1,
            {
              link: {
                kind: 'check',
                n: 1,
                checks: [{ type: 'check', ability: 'wis' }],
              },
              secret: true,
            },
          ],
        ]),
      )
    })

    it('reads a link as the page does: the first of its number, never one inside another', () => {
      const html =
        '<span class="ss-roll roll" data-n="0" data-formula="1d6">' +
        '<span class="ss-roll roll" data-n="1" data-formula="1d8">x</span></span>' +
        '<span class="ss-roll roll" data-n="0" data-formula="1d10">y</span>' +
        '<a href="https://example.com"><span class="ss-roll roll" data-n="2" data-formula="1d4">z</span></a>' +
        '</section><span class="ss-roll roll" data-n="3" data-formula="1d12">w</span>'

      expect([...sheetLinks(html).values()]).toEqual([
        { link: { kind: 'roll', n: 0, formula: '1d6' }, secret: false },
        { link: { kind: 'roll', n: 3, formula: '1d12' }, secret: false },
      ])
    })

    it('finds none in a description without them', () => {
      expect(
        sheetLinks('<p>Nothing <span class="roll">2d6</span></p>'),
      ).toEqual(new Map())
      expect(sheetLinks('')).toEqual(new Map())
    })
  })
})
