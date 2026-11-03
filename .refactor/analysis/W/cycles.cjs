// Map W: import cycles (strongly connected components) in src/**, runtime edges only and with
// type-only imports, marking those that touch W's area. Also lists barrel files (index.ts[x]).
// Usage: node .refactor/analysis/W/cycles.cjs
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const AREA = /^src\/(schemas|types|constants|mocks)\/|^src\/utils\/roll-requests/;
function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o); else if (/\.(ts|tsx)$/.test(e.name)) o.push(p);
  }
  return o;
}
function resolve(spec, from) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec === '@test-utils') base = path.join(SRC, 'utils/test-utils');
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')])
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}
const files = walk(SRC).filter((f) => !/\.test\.tsx?$/.test(f));
const rel = (p) => path.relative(ROOT, p);
const runtime = new Map(), all = new Map();
for (const f of files) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  runtime.set(f, new Set()); all.set(f, new Set());
  for (const st of sf.statements) {
    if (!(ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) || !st.moduleSpecifier) continue;
    const t = resolve(st.moduleSpecifier.text, f);
    if (!t || /\.test\./.test(t)) continue;
    let typeOnly = ts.isImportDeclaration(st) ? !!st.importClause?.isTypeOnly : st.isTypeOnly;
    if (!typeOnly && ts.isImportDeclaration(st) && st.importClause && !st.importClause.name) {
      const nb = st.importClause.namedBindings;
      if (nb && ts.isNamedImports(nb) && nb.elements.length && nb.elements.every((e) => e.isTypeOnly)) typeOnly = true;
    }
    if (ts.isImportDeclaration(st) && !st.importClause) typeOnly = false;
    all.get(f).add(t);
    if (!typeOnly) runtime.get(f).add(t);
  }
}
function scc(g) {
  let i = 0; const idx = new Map(), low = new Map(), on = new Set(), st = [], out = [];
  const strong = (v) => {
    idx.set(v, i); low.set(v, i); i++; st.push(v); on.add(v);
    for (const w of g.get(v) || []) {
      if (!g.has(w)) continue;
      if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) { const c = []; let w; do { w = st.pop(); on.delete(w); c.push(w); } while (w !== v); if (c.length > 1) out.push(c); }
  };
  for (const v of g.keys()) if (!idx.has(v)) strong(v);
  return out;
}
for (const [name, g] of [['runtime', runtime], ['with type-only imports', all]]) {
  const cs = scc(g);
  console.log(`## cycles (${name}): ${cs.length}`);
  for (const c of cs) {
    const r = c.map(rel).sort();
    console.log(`${r.some((x) => AREA.test(x)) ? '[W] ' : ''}${r.length} files: ${r.join(' ')}`);
  }
}
console.log('## barrels (index.ts/tsx) in W area');
for (const f of walk(SRC)) if (/\/index\.tsx?$/.test(f) && AREA.test(rel(f))) console.log(rel(f));
