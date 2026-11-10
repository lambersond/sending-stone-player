import { tidyText } from './reader'
import { tidyJournal } from '@/mocks/notes-server'

describe('utils/reader', () => {
  it('reads a Tidy entry’s text with its paragraphs a space apart, as its card and search take it', () => {
    const [entry] = tidyJournal().entries
    expect(
      tidyText({
        ...entry,
        html: '<p>He sees far.</p><section class="secret"><p>He is the heir of Girion.</p></section>',
      }),
    ).toBe('He sees far. He is the heir of Girion.')
  })
})
