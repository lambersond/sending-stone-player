import { typingInText } from './text-focus'

/** An element of this tag, with these attributes, put on the page. */
function element(tag: string, attributes: Record<string, string> = {}) {
  const made = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) {
    made.setAttribute(name, value)
  }
  document.body.replaceChildren(made)
  return made
}

describe('features/rolling/utils/text-focus (module 0.45.0)', () => {
  it.each([
    ['the chat’s text area', 'textarea', {}, true],
    ['a field with no type, as a note’s title', 'input', {}, true],
    ['a text field', 'input', { type: 'text' }, true],
    ['a number field, as the hit points’', 'input', { type: 'number' }, true],
    ['a search field', 'input', { type: 'search' }, true],
    ['an email field', 'input', { type: 'email' }, true],
    ['a web address field', 'input', { type: 'url' }, true],
    ['a phone field', 'input', { type: 'tel' }, true],
    ['a password field', 'input', { type: 'password' }, true],
    ['an editable region', 'div', { contenteditable: 'true' }, true],
    [
      'a dice box, which opens no keyboard',
      'input',
      { type: 'text', inputmode: 'none' },
      false,
    ],
    ['a button', 'button', {}, false],
    ['a checkbox', 'input', { type: 'checkbox' }, false],
  ])('%s: %s', (_, tag, attributes, typing) => {
    expect(typingInText(element(tag, attributes))).toBe(typing)
  })

  it('takes nothing focused, as the page itself, as not typing', () => {
    expect(typingInText(null)).toBe(false)
  })
})
