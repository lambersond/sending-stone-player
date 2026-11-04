// Amendment 4 (c): a relative import (or re-export) that leaves its feature, or its top folder of
// src, is written as an `@/` path. Import lines only. Usage: node at-imports.mjs <checkout> [--write]
import fs from 'node:fs'
import path from 'node:path'
import ts from '/home/user/sending-stone-player/node_modules/typescript/lib/typescript.js'
import { Checkout } from '/home/user/sending-stone-player/.refactor/tools/gate-lib.mjs'

const root = path.resolve(process.argv[2])
const write = process.argv.includes('--write')
const co = new Checkout(root, '/tmp')
const FROZEN = f => f.startsWith('src/__tests__/golden/') || f === 'src/utils/test-utils.ts' || f === 'src/utils/test-utils.test.ts' || f === 'src/utils/test-utils-node.ts' || f === 'src/mocks/dice-renderer.ts' || f.startsWith('src/mocks/sheet-providers/')
const unitOf = f => {
  const p = f.split('/')
  if (p[1] === 'features') return p.slice(0, 3).join('/')
  return p.length > 2 ? p.slice(0, 2).join('/') : 'src'
}
const files = co.files.filter(f => f.startsWith('src/') && /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') && !FROZEN(f))
let count = 0
const changed = []
for (const file of files) {
  const text = co.text(file)
  const sf = co.parse(file)
  const edits = []
  for (const st of sf.statements) {
    if (!(ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) || !st.moduleSpecifier) continue
    const spec = st.moduleSpecifier.text
    if (!spec.startsWith('.')) continue
    const target = co.resolver.resolve(spec, file).file
    if (!target || !/\.(ts|tsx)$/.test(target)) continue
    if (unitOf(target) === unitOf(file)) continue
    const to = '@/' + target.slice('src/'.length).replace(/\.(ts|tsx)$/, '').replace(/\/index$/, '')
    const quote = text[st.moduleSpecifier.getStart(sf)]
    edits.push([st.moduleSpecifier.getStart(sf), st.moduleSpecifier.getEnd(), quote + to + quote])
    count += 1
    if (!write) console.log(`${file}\t${spec}\t${to}`)
  }
  if (edits.length && write) {
    let out = text
    for (const [s, e, put] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + put + out.slice(e)
    fs.writeFileSync(path.join(root, file), out)
    changed.push(file)
  }
}
if (write) fs.writeFileSync(process.env.AT_CHANGED ?? '/dev/null', changed.join('\n') + '\n')
console.error(`${count} specifiers${write ? ` in ${changed.length} files rewritten` : ''}`)
