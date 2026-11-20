import { placesBeside, rowControlOf } from './focus-beside'

/** The page, as drawn: each element of note with an id. */
const page = (html: string) => {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  document.body.replaceChildren(
    ...[...parsed.body.childNodes].map(node => document.adoptNode(node)),
  )
}
const ids = (from: string) =>
  placesBeside(document.querySelector<HTMLElement>(`#${from}`)!).map(
    place => place.id,
  )

/** Three rows of a tab's list: A closed, B open with its Give…, C a row that takes focus. */
const LIST = `
  <div role="tabpanel" tabindex="-1" id="panel"><ul>
    <li><details><summary id="a">A</summary></details></li>
    <li><details open><summary id="b">B</summary><div><button id="give-b">Give…</button></div></details></li>
    <li><div tabindex="0" id="c">C</div></li>
  </ul></div>`

describe('utils/focus-beside', () => {
  afterEach(() => document.body.replaceChildren())

  it.each([
    [
      'the other buttons in its group, as Add or remove beside Give',
      `<div role="tabpanel" tabindex="-1" id="panel"><div role="group">
        <button id="change">Add or remove</button><button id="give">Give</button>
      </div></div>`,
      'give',
      ['change', 'panel'],
    ],
    [
      "a row's opened body: the row's own control, then the next row's, the previous row's, the panel",
      LIST,
      'give-b',
      ['b', 'c', 'a', 'panel'],
    ],
    [
      'the last row of a list: the previous row’s, then the panel',
      LIST,
      'c',
      ['b', 'panel'],
    ],
    [
      'an only row: the panel',
      `<div role="tabpanel" tabindex="-1" id="panel"><ul>
        <li><details><summary id="only">Only</summary></details></li>
      </ul></div>`,
      'only',
      ['panel'],
    ],
    [
      'a row that rolls, its name a button of its own: that button',
      `<div role="tabpanel" tabindex="-1" id="panel"><ul>
        <li><div><button id="name" aria-expanded="true">Longsword</button><span><button id="chip">+5</button></span></div>
          <div><button id="give">Give…</button></div></li>
      </ul></div>`,
      'give',
      ['name', 'panel'],
    ],
    [
      'outside any panel or row: nowhere',
      '<button id="lone">Give</button>',
      'lone',
      [],
    ],
  ])('takes focus from %s', (_, html, from, beside) => {
    page(html)

    expect(ids(from)).toEqual(beside)
  })

  it("finds a row's own control, and none for no row", () => {
    page(LIST)
    const [, open] = document.querySelectorAll('li')

    expect(rowControlOf(open)?.id).toBe('b')
    expect(rowControlOf(null)).toBeUndefined()
    expect(rowControlOf(undefined)).toBeUndefined()
  })
})
