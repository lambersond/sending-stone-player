/** The inputs a keyboard types words into, whose focus a dialog opening by itself would take. */
const TEXT_TYPES: ReadonlySet<string> = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
])

/**
 * Is the player typing in a text field, such as the chat's, from module 0.44.0: one a dialog
 * opening by itself would take from them? A text area, an editable region, or an input that takes
 * words; never the dice dialog's own boxes, which open no keyboard (`inputmode="none"`), nor a
 * button or a checkbox.
 */
export function typingInText(focused: Element | null): boolean {
  if (!(focused instanceof HTMLElement)) return false
  if (focused instanceof HTMLTextAreaElement) return true
  if (focused.closest('[contenteditable=""], [contenteditable="true"]')) {
    return true
  }
  return (
    focused instanceof HTMLInputElement &&
    focused.inputMode !== 'none' &&
    TEXT_TYPES.has(focused.type)
  )
}
