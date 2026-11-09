/**
 * @jest-environment node
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'

// The linter's fixes keep a type guard's narrowing: unicorn's prefer-native-coercion-functions
// would write `(x): x is T => Boolean(x)` as `Boolean`, which narrows nothing, so tsc failed on
// what typechecked before `eslint --fix` (eslint.config.mjs's
// `app/prefer-native-coercion-functions`).

const ROOT = path.resolve(path.dirname(expect.getState().testPath!), '../..')

/** What the repository's linter says of some code in a module under src, its fixes not written. */
function lint(code: string): { output?: string; rules: string[] } {
  let json: string
  try {
    json = execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'node_modules/eslint/bin/eslint.js'),
        '--stdin',
        '--stdin-filename',
        'src/utils/probe.ts',
        '--fix-dry-run',
        '--format',
        'json',
      ],
      { cwd: ROOT, input: code, encoding: 'utf8' },
    )
  } catch (error) {
    // The linter exits 1 where it finds something, with its report all the same.
    json = (error as { stdout: string }).stdout
  }
  const [result] = JSON.parse(json) as {
    output?: string
    messages: { ruleId: string | null }[]
  }[]
  return {
    output: result.output,
    rules: result.messages.map(({ ruleId }) => ruleId ?? ''),
  }
}

describe('lint: native coercion functions', () => {
  it('keeps a type guard written with Boolean', () => {
    const code = [
      'export const kept = (xs: (string | undefined)[]): string[] =>',
      '  xs.filter((x): x is string => Boolean(x))',
      '',
    ].join('\n')
    const { output, rules } = lint(code)
    expect(rules).toEqual([])
    expect(output).toBeUndefined()
  }, 60_000)

  it('still has Boolean itself used where no type is guarded', () => {
    const code = [
      'export const kept = (xs: string[]): string[] =>',
      '  xs.filter(x => Boolean(x))',
      '',
    ].join('\n')
    expect(lint(code).output).toContain('xs.filter(Boolean)')
  }, 60_000)
})
