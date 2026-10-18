'use client'

import { Search } from 'lucide-react'

/**
 * A box to search a list by, such as the character's spells by name. Its text is 16px, as iOS
 * zooms into a smaller one it focuses, and a dialog it's in would stay zoomed after. Enter, or a
 * phone keyboard's Search, only puts the keyboard away, and never picks or sends anything. Escape
 * clears what's typed first, and only then, with nothing typed, closes a dialog it's in: the
 * browser takes the key as a request to close it, unless it's cancelled, as this does. It never
 * takes focus by itself, so no keyboard covers a list as it opens.
 */
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: Readonly<{
  value: string
  onChange: (value: string) => void
  /** What a screen reader is told it searches, such as "Search spells by name". */
  label: string
  placeholder: string
}>) {
  return (
    <div className='relative'>
      <Search
        aria-hidden
        className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-secondary'
      />
      <input
        type='search'
        enterKeyHint='search'
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          // A key that ends composing a character, as with an IME, is the IME's. Safari sends it
          // once the composing has ended, so not as composing, but still with the IME's code, 229.
          const { isComposing, keyCode } = event.nativeEvent
          if (isComposing || keyCode === 229) return
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          } else if (event.key === 'Escape' && value !== '') {
            // Cancelled, the browser neither clears the box itself nor closes the dialog.
            event.preventDefault()
            onChange('')
          }
        }}
        aria-label={label}
        placeholder={placeholder}
        autoComplete='off'
        spellCheck={false}
        className='h-11 w-full rounded-xl border border-border bg-page pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-primary/40'
      />
    </div>
  )
}
