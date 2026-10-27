/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ISSUE_FORMS } from './links'

/**
 * The fields of the bug form the app links to, in its order, as GitHub reads them: each one's id,
 * its label, and its checkboxes' labels.
 */
function bugFormFields() {
  const template = new URL(ISSUE_FORMS.bug).searchParams.get('template')
  const text = readFileSync(
    path.join(process.cwd(), '.github/ISSUE_TEMPLATE', template ?? ''),
    'utf8',
  )
  return text
    .split(/^ {2}- type: /m)
    .slice(1)
    .map(field => ({
      id: /^ {4}id: (.+)$/m.exec(field)?.[1],
      label: /^ {6}label: (.+)$/m.exec(field)?.[1],
      options: [...field.matchAll(/^ {8}- label: (.+)$/gm)].map(
        ([, label]) => label,
      ),
    }))
}

describe('constants/links, the bug form', () => {
  it('asks which of the cog’s settings were on, and which of the campaign’s switches in Foundry apart', () => {
    const fields = bugFormFields()
    expect(fields.find(({ id }) => id === 'settings')).toEqual({
      id: 'settings',
      label: "Which of the sheet's settings (the cog) were on?",
      options: [
        'Send to the table',
        'Damage on its own',
        'Enter dice results manually',
      ],
    })
    // Round 0.40.0 §8, corrected: Wild Shape's is the Gamemaster's switch, on the campaign's Player
    // actions tab in Foundry, never one of the sheet's settings; asked after the sheet's, before
    // the module's version, which the Gamemaster also knows.
    const ids = fields.map(({ id }) => id)
    expect(fields.find(({ id }) => id === 'switches')).toEqual({
      id: 'switches',
      label: "Which of the campaign's switches in Foundry were on?",
      options: ['Allow Players to use Wild Shape from the app'],
    })
    expect(
      ids.slice(ids.indexOf('settings'), ids.indexOf('module-version') + 1),
    ).toEqual(['settings', 'roll-results', 'switches', 'module-version'])
  })
})
