// Map T: what the e2e suites read from the app (selectors, roles, names, ids, data attributes,
// texts, request paths), grouped by app area. Read-only over e2e/*.mjs.
// usage: node e2e-surface.mjs <repo> <fullOut> > summary.txt
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [repo, fullOut] = process.argv.slice(2)
const dir = join(repo, 'e2e')
const AREA = {
  sheet: 'sheet actions activities attacks favorites favoriting favres uses effects conditions wildshape links typed manualdice midi rolls rolling results damagecard alone prompts organize',
  table: 'endturn toasts layout fullscreen phone theme sync gm gmerr gmroll feedback late-setup step1 step2 step3',
  notes: 'notes notesoffline notesorder journal-ui partynotes',
  party: 'party givetake transfers removals',
  companions: 'companions companionsaves',
  campaigns: 'campaigns settings',
  cookbook: 'cookbook cookbook-post',
  harness: 'env world-030',
}
const areaOf = suite =>
  Object.entries(AREA).find(([, s]) => s.split(' ').includes(suite))?.[0] ?? 'other'

const str = String.raw`('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\x60(?:[^\x60\\]|\\.)*\x60|\/(?:[^/\\\n]|\\.)+\/[a-z]*)`
const PATTERNS = {
  role: new RegExp(String.raw`getByRole\(\s*'([a-z]+)'\s*(?:,\s*\{[^}]*?name:\s*${str})?`, 'g'),
  text: new RegExp(String.raw`getByText\(\s*${str}`, 'g'),
  label: new RegExp(String.raw`getByLabel\(\s*${str}`, 'g'),
  css: new RegExp(String.raw`(?:locator|querySelector(?:All)?|\$\$?|waitForSelector)\(\s*${str}`, 'g'),
  url: new RegExp(String.raw`${str}`, 'g'),
}
const ID = /#[A-Za-z][\w-]*/g
const DATA = /\[data-[a-z-]+(?:[~^$*|]?=(?:"[^"]*"|'[^']*'|[^\]]*))?\]/g
const API = /\/api\/[A-Za-z0-9_\-/${}.:\[\]]+/g

const per = {}
const all = { roles: new Map(), ids: new Map(), data: new Map(), api: new Map(), texts: new Map() }
const bump = (m, k, s) => {
  const e = m.get(k) ?? new Set()
  e.add(s)
  m.set(k, e)
}
for (const file of readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
  const suite = file.replace(/(-e2e)?\.mjs$/, '')
  const src = readFileSync(join(dir, file), 'utf8')
  const area = areaOf(suite)
  const out = (per[`${area}/${suite}`] = { role: [], text: [], label: [], css: [], api: new Set() })
  for (const m of src.matchAll(PATTERNS.role)) {
    const k = m[2] ? `${m[1]} ${m[2]}` : m[1]
    out.role.push(k)
    bump(all.roles, k, suite)
  }
  for (const kind of ['text', 'label']) {
    for (const m of src.matchAll(PATTERNS[kind])) {
      out[kind].push(m[1])
      bump(all.texts, `${kind}:${m[1]}`, suite)
    }
  }
  for (const m of src.matchAll(PATTERNS.css)) {
    out.css.push(m[1])
    for (const id of m[1].match(ID) ?? []) bump(all.ids, id, suite)
    for (const d of m[1].match(DATA) ?? []) bump(all.data, d, suite)
  }
  for (const d of src.match(DATA) ?? []) bump(all.data, d, suite)
  for (const a of src.match(API) ?? []) {
    out.api.add(a)
    bump(all.api, a.replace(/\$\{[^}]*\}/g, ':x'), suite)
  }
}
const lines = []
for (const [k, v] of Object.entries(per)) {
  lines.push(`## ${k}`)
  for (const kind of ['role', 'label', 'text', 'css']) {
    const u = [...new Set(v[kind])]
    if (u.length) lines.push(`  ${kind} (${u.length}): ${u.join(' | ')}`)
  }
  if (v.api.size) lines.push(`  api: ${[...v.api].join(' ')}`)
}
writeFileSync(fullOut, lines.join('\n') + '\n')

const byArea = {}
for (const [k, v] of Object.entries(per)) {
  const a = k.split('/')[0]
  const e = (byArea[a] ??= { suites: 0, role: new Set(), text: new Set(), label: new Set(), css: new Set(), api: new Set() })
  e.suites++
  for (const kind of ['role', 'text', 'label', 'css']) v[kind].forEach(x => e[kind].add(x))
  v.api.forEach(x => e.api.add(x))
}
console.log('# e2e surface summary (distinct per area)')
console.log('area suites roles texts labels css apiPaths')
for (const [a, e] of Object.entries(byArea)) {
  console.log(`${a} ${e.suites} ${e.role.size} ${e.text.size} ${e.label.size} ${e.css.size} ${e.api.size}`)
}
const dump = (title, m, min = 1) => {
  console.log(`\n# ${title}`)
  for (const [k, v] of [...m].sort((x, y) => y[1].size - x[1].size || x[0].localeCompare(y[0]))) {
    if (v.size >= min) console.log(`${k}  <- ${[...v].join(',')}`)
  }
}
dump('ids read (#id in CSS)', all.ids)
dump('data attributes read', all.data)
dump('api paths named', all.api)
dump('roles+names read by 4+ suites', all.roles, 4)
