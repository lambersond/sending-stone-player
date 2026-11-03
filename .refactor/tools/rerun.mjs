// L1's rerun of red tests (round.md §2.3.6, §3.1.5): `node rerun.mjs <outdir> <checkout>` runs each
// test red in <outdir>/jest.json once more, alone (`jest --ci --runInBand -t '^<fullName>$' <file>`,
// at most 20), and writes <outdir>/reruns.tsv: file, fullName (escaped), passed|failed.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { escapeField } from './gate-lib.mjs'

const [outdir, checkout] = process.argv.slice(2)
const json = JSON.parse(fs.readFileSync(path.join(outdir, 'jest.json'), 'utf8'))
const red = json.testResults.flatMap(suite =>
  suite.assertionResults.filter(test => test.status === 'failed').map(test => [suite.name, test.fullName]),
)
const regex = text => text.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')
const rows = []
for (const [file, fullName] of red.slice(0, 20)) {
  const run = spawnSync('npx', ['jest', '--ci', '--runInBand', '-t', `^${regex(fullName)}$`, file], {
    cwd: checkout,
    encoding: 'utf8',
  })
  fs.appendFileSync(path.join(outdir, 'reruns.log'), `${file} ${fullName}\n${run.stdout}${run.stderr}\n`)
  rows.push([path.relative(checkout, file), escapeField(fullName), run.status === 0 ? 'passed' : 'failed'].join('\t'))
}
if (rows.length > 0) fs.writeFileSync(path.join(outdir, 'reruns.tsv'), rows.join('\n') + '\n')
process.stdout.write(`${red.length} red, ${rows.length} rerun alone\n`)
