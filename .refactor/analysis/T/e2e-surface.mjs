// Map T: what the e2e suites read from the app (selectors, roles, names, ids, data attributes,
// texts, request paths), grouped by app area. Read-only over e2e/*.mjs.
// Extended by C-a (round.md §1.8.1, Phase 1) with the reads that bypass a selector: `getAttribute`
// names, `dataset` keys (as data-*), class reads (`classList.*`, `.className`) and child structure
// (`.children`, first/lastElementChild, childElementCount, tagName/nodeName), each with suite:line.
// Some of these read the Foundry stand-in's or a chat card's DOM, not the app's; the list keeps
// every read so a review can tell them apart.
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
const READS = {
  attribute: /getAttribute\(\s*'([^']+)'/g,
  dataset: /dataset(?:\?)?(?:\.([A-Za-z]+)|\[\s*'([^']+)'\s*\])/g,
  classList: /classList\.(?:contains|toggle|add|remove)\(\s*'([^']+)'/g,
  className: /\.className\b/g,
  children: /\.(children|firstElementChild|lastElementChild|childElementCount|tagName|nodeName)\b/g,
}
const kebab = key => `data-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`
const ID = /#[A-Za-z][\w-]*/g
const DATA = /\[data-[a-z-]+(?:[~^$*|]?=(?:"[^"]*"|'[^']*'|[^\]]*))?\]/g
const API = /\/api\/[A-Za-z0-9_\-/${}.:\[\]]+/g

const per = {}
const all = {
  roles: new Map(), ids: new Map(), data: new Map(), api: new Map(), texts: new Map(),
  attributes: new Map(), dataset: new Map(), classes: new Map(), children: new Map(),
}
const bump = (m, k, s) => {
  const e = m.get(k) ?? new Set()
  e.add(s)
  m.set(k, e)
}
for (const file of readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
  const suite = file.replace(/(-e2e)?\.mjs$/, '')
  const src = readFileSync(join(dir, file), 'utf8')
  const area = areaOf(suite)
  const out = (per[`${area}/${suite}`] = {
    role: [], text: [], label: [], css: [], api: new Set(), attribute: [], dataset: [], class: [], children: [],
  })
  const lineOf = index => src.slice(0, index).split('\n').length
  for (const m of src.matchAll(READS.attribute)) {
    out.attribute.push(m[1])
    bump(all.attributes, m[1], `${suite}:${lineOf(m.index)}`)
  }
  for (const m of src.matchAll(READS.dataset)) {
    const k = m[1] ? kebab(m[1]) : m[2]
    out.dataset.push(k)
    bump(all.dataset, k, `${suite}:${lineOf(m.index)}`)
  }
  for (const m of src.matchAll(READS.classList)) {
    out.class.push(m[1])
    bump(all.classes, m[1], `${suite}:${lineOf(m.index)}`)
  }
  for (const m of src.matchAll(READS.className)) {
    out.class.push('(className)')
    bump(all.classes, '(className)', `${suite}:${lineOf(m.index)}`)
  }
  for (const m of src.matchAll(READS.children)) {
    out.children.push(m[1])
    bump(all.children, m[1], `${suite}:${lineOf(m.index)}`)
  }
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
  for (const kind of ['role', 'label', 'text', 'css', 'attribute', 'dataset', 'class', 'children']) {
    const u = [...new Set(v[kind])]
    if (u.length) lines.push(`  ${kind} (${u.length}): ${u.join(' | ')}`)
  }
  if (v.api.size) lines.push(`  api: ${[...v.api].join(' ')}`)
}
writeFileSync(fullOut, lines.join('\n') + '\n')

const byArea = {}
for (const [k, v] of Object.entries(per)) {
  const a = k.split('/')[0]
  const e = (byArea[a] ??= {
    suites: 0, role: new Set(), text: new Set(), label: new Set(), css: new Set(), api: new Set(),
    attribute: new Set(), dataset: new Set(), class: new Set(), children: new Set(),
  })
  e.suites++
  for (const kind of ['role', 'text', 'label', 'css', 'attribute', 'dataset', 'class', 'children']) {
    v[kind].forEach(x => e[kind].add(x))
  }
  v.api.forEach(x => e.api.add(x))
}
console.log('# e2e surface summary (distinct per area)')
console.log('area suites roles texts labels css apiPaths attributes datasetKeys classes childReads')
for (const [a, e] of Object.entries(byArea)) {
  const sizes = [e.role, e.text, e.label, e.css, e.api, e.attribute, e.dataset, e.class, e.children].map(x => x.size)
  console.log(`${a} ${e.suites} ${sizes.join(' ')}`)
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
// suite:line lists: one entry per read, so a review can open each
dump('attributes read (getAttribute; suite:line)', all.attributes)
dump('dataset keys read (as data-*; suite:line)', all.dataset)
dump('classes read (classList.contains/toggle/add/remove, and .className; suite:line)', all.classes)
dump('child structure read (children, first/lastElementChild, childElementCount, tagName, nodeName; suite:line)', all.children)
