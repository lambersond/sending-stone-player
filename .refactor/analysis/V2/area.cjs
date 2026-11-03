// V2 area inventory from graph.json. usage: node area.cjs <graph.json> <outdir>
const fs = require('fs')
const g = require(process.argv[2])
const outdir = process.argv[3]
const comps = 'notes party-sheet companions campaigns character-chooser character-list transfers cookbook-card avatar copy-button help-links icons invite-form logo modal page-toast scroller search-field side-panel sign-in-buttons sign-out-button site-footer site-header theme-provider theme-toggle'.split(' ')
const hooks = 'use-notes use-party-sheet use-companion-view use-cookbook-view use-transfers use-stored use-media-query use-width use-keyboard-inset use-image-fallback use-hydrated use-modal-dialog'.split(' ')
const utils = 'note-headings note-id note-time note-words campaign-order companion-row creature-words format-amount format-modifier game-host literal-pattern order-words search seat-words safe-next alone-choices table-pages'.split(' ')
const inArea = f =>
  comps.some(c => f.startsWith('src/components/' + c + '/')) ||
  hooks.some(h => f.startsWith('src/hooks/' + h + '.')) ||
  utils.some(u => f.startsWith('src/utils/' + u + '.')) ||
  (f.startsWith('src/app/') && !f.startsWith('src/app/api/') && !/\/actions(\.test)?\.ts$/.test(f))
const area = Object.keys(g).filter(inArea).sort()
const importers = {}
for (const [f, r] of Object.entries(g)) for (const i of r.imports) if (i.to) (importers[i.to] ||= []).push({ from: f, names: i.names, typeOnly: i.typeOnly, reexport: !!i.reexport })
const mockers = {}
for (const [f, r] of Object.entries(g)) for (const m of r.mocks) if (m.to) (mockers[m.to] ||= []).push(f)
const isTest = f => /\.test\.tsx?$/.test(f)
// importers through a barrel: if X is imported by index.ts, then index's importers count too
const lines = []
const cross = []
for (const f of area) {
  const r = g[f]
  const ex = r.exports.map(e => e.name + ':' + e.kind).join(', ')
  const imps = importers[f] || []
  const viaBarrel = []
  for (const i of imps) if (/\/index\.ts$/.test(i.from)) for (const j of importers[i.from] || []) viaBarrel.push({ ...j, names: j.names.filter(n => i.names.includes(n) || i.names.includes('*')), via: i.from })
  const all = imps.filter(i => !/\/index\.ts$/.test(i.from)).concat(viaBarrel.filter(v => v.names.length))
  const outside = all.filter(i => !inArea(i.from))
  const kind = f.endsWith('.test.tsx') || f.endsWith('.test.ts') ? 'test' : /\/index\.ts$/.test(f) ? 'barrel' : /\/(page|layout|not-found)\.tsx$/.test(f) ? 'route' : f.endsWith('.tsx') ? (r.client ? 'client-tsx' : 'tsx') : (r.client ? 'client-ts' : 'ts')
  lines.push([f, r.lines, kind, ex].join('\t'))
  for (const o of outside) cross.push([f, o.from, (o.names || []).join(','), o.typeOnly ? 'type' : 'value', o.via || ''].join('\t'))
}
fs.writeFileSync(outdir + '/inventory.tsv', 'path\tlines\tkind\texports\n' + lines.join('\n') + '\n')
fs.writeFileSync(outdir + '/cross-edges.tsv', 'mine\timporter\tnames\tkind\tvia\n' + cross.join('\n') + '\n')
// mocks of my files from anywhere, and mocks inside my tests
const mk = []
for (const f of area) for (const m of mockers[f] || []) mk.push(['mocked', f, 'by', m].join('\t'))
for (const f of area) for (const m of g[f].mocks) mk.push(['mocks', f, m.fn, m.spec, m.to].join('\t'))
fs.writeFileSync(outdir + '/mocks.tsv', mk.join('\n') + '\n')
// types in .tsx, exported types in non-types.ts
const ty = []
for (const f of area) {
  const r = g[f]
  if (isTest(f)) continue
  if (f.endsWith('.tsx')) for (const t of r.types) ty.push(['tsx-type', f + ':' + t.line, t.name, t.exported ? 'exported' : t.nested ? 'nested' : 'local'].join('\t'))
  else if (!/types\.ts$/.test(f)) for (const t of r.types) if (t.exported) ty.push(['ts-exported-type', f + ':' + t.line, t.name].join('\t'))
}
fs.writeFileSync(outdir + '/types.tsv', ty.join('\n') + '\n')
// .tsx with >1 export (non-test)
const multi = []
for (const f of area) {
  if (!f.endsWith('.tsx') || isTest(f)) continue
  const ex = g[f].exports
  const nonFw = ex.filter(e => !['metadata', 'generateMetadata', 'viewport', 'dynamic', 'revalidate', 'generateStaticParams'].includes(e.name))
  if (nonFw.length > 1 || nonFw.some(e => e.kind !== 'component' && !e.name.startsWith('default'))) multi.push([f, nonFw.length, nonFw.map(e => e.name + ':' + e.kind + '@' + e.line).join(', ')].join('\t'))
}
fs.writeFileSync(outdir + '/tsx-multi.tsv', multi.join('\n') + '\n')
// disables
const dis = []
for (const f of area) for (const d of g[f].disables) dis.push([f + ':' + d.line, d.scope, d.rules, d.reason || '(none)'].join('\t'))
fs.writeFileSync(outdir + '/disables.tsv', dis.join('\n') + '\n')
// barrels
const bar = area.filter(f => /\/index\.ts$/.test(f)).map(f => f + '\t' + (importers[f] || []).length + ' importers\t' + (importers[f] || []).map(i => i.from).join(' '))
fs.writeFileSync(outdir + '/barrels.tsv', bar.join('\n') + '\n')
// what my non-test files import from outside the area (dependency direction)
const deps = []
for (const f of area) { if (isTest(f)) continue; for (const i of g[f].imports) if (i.to && i.to.startsWith('src/') && !inArea(i.to)) deps.push([f, i.to, i.names.join(','), i.typeOnly ? 'type' : 'value'].join('\t')) }
fs.writeFileSync(outdir + '/out-deps.tsv', deps.join('\n') + '\n')
console.log('area files', area.length, 'non-test', area.filter(f => !isTest(f)).length, 'cross edges', cross.length, 'multi-tsx', multi.length, 'types', ty.length, 'disables', dis.length, 'barrels', bar.length)
