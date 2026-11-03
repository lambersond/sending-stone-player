// Mapper R: import graph, exports and cross-area importers for the rolling area.
// Usage: node .refactor/analysis/R/graph.cjs <outdir>   (run from the app root)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = process.cwd();
const OUT = process.argv[2] || '.';
const AREA = [
  /^src\/components\/dice-entry\//,
  /^src\/components\/character-sheet\/(roll-tray|roll-button|roll-menu|rolls-button|roll-toasts|modify-roll|d20-rolls|damage-menu)(\.|$)/,
  /^src\/hooks\/(use-sheet-roller|use-table-rolls|use-roll-toasts|use-rolls-locked|use-hold)(\.|$)/,
  /^src\/utils\/(effect-dice|typed-dice|faces|formulas|damage-modifiers|dice-modifiers|roll-modifiers|damage-alone|move-words|roll-toasts|roll-mode)(\.|$)/,
];
const inArea = (f) => AREA.some((r) => r.test(f));

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(path.relative(ROOT, p));
  }
  return acc;
}
const files = walk(path.join(ROOT, 'src'));
const fileSet = new Set(files);
function resolve(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = 'src/' + spec.slice(2);
  else if (spec === '@test-utils') base = 'src/utils/test-utils';
  else if (spec.startsWith('.')) base = path.normalize(path.join(path.dirname(from), spec));
  else return null;
  for (const c of [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'])
    if (fileSet.has(c)) return c;
  return 'UNRESOLVED:' + base;
}

const graph = {}; // file -> [{to, names, typeOnly, kind}]
const exportsOf = {};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edges = [];
  const exps = [];
  const visit = (n) => {
    if (ts.isImportDeclaration(n) || (ts.isExportDeclaration(n) && n.moduleSpecifier)) {
      const spec = n.moduleSpecifier.text;
      const to = resolve(f, spec);
      let names = [];
      let typeOnly = false;
      if (ts.isImportDeclaration(n)) {
        const c = n.importClause;
        typeOnly = !!(c && c.isTypeOnly);
        if (c) {
          if (c.name) names.push('default');
          if (c.namedBindings) {
            if (ts.isNamespaceImport(c.namedBindings)) names.push('*');
            else names.push(...c.namedBindings.elements.map((e) => (e.isTypeOnly ? 'type ' : '') + (e.propertyName || e.name).text));
          }
        }
      } else {
        typeOnly = n.isTypeOnly;
        names.push(n.exportClause ? 're:' + n.exportClause.elements.map((e) => e.name.text).join(',') : 're:*');
      }
      if (to) edges.push({ to, names, typeOnly, spec });
    }
    if (ts.isCallExpression(n) && n.arguments.length && ts.isStringLiteral(n.arguments[0])) {
      const callee = n.expression.getText(sf);
      if (/^jest\.(mock|requireActual|requireMock|doMock)$/.test(callee)) {
        const to = resolve(f, n.arguments[0].text);
        if (to) edges.push({ to, names: [callee], typeOnly: false, spec: n.arguments[0].text, mock: true });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  for (const st of sf.statements) {
    const mods = ts.getCombinedModifierFlags ? (st.modifiers || []).map((m) => m.kind) : [];
    const isExp = mods.includes(ts.SyntaxKind.ExportKeyword);
    const isDef = mods.includes(ts.SyntaxKind.DefaultKeyword);
    if (!isExp) {
      if (ts.isExportDeclaration(st) && st.exportClause && !st.moduleSpecifier)
        for (const e of st.exportClause.elements) exps.push({ name: e.name.text, kind: 'reexport-local' });
      if (ts.isExportAssignment(st)) exps.push({ name: 'default', kind: 'export=' });
      continue;
    }
    let kind = '?';
    let names = [];
    if (ts.isFunctionDeclaration(st)) { kind = 'function'; names = [st.name ? st.name.text : 'default']; }
    else if (ts.isClassDeclaration(st)) { kind = 'class'; names = [st.name ? st.name.text : 'default']; }
    else if (ts.isTypeAliasDeclaration(st)) { kind = 'type'; names = [st.name.text]; }
    else if (ts.isInterfaceDeclaration(st)) { kind = 'interface'; names = [st.name.text]; }
    else if (ts.isEnumDeclaration(st)) { kind = 'enum'; names = [st.name.text]; }
    else if (ts.isVariableStatement(st)) {
      kind = 'const';
      for (const d of st.declarationList.declarations) {
        let k = 'const';
        const init = d.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) k = 'function';
        names.push(d.name.getText(sf) + '|' + k);
      }
    }
    for (const nm of names) {
      const [n0, k0] = nm.split('|');
      let k = k0 || kind;
      if ((k === 'function') && /^[A-Z]/.test(n0) && f.endsWith('.tsx')) k = 'component';
      if ((k === 'function') && /^use[A-Z]/.test(n0)) k = 'hook';
      exps.push({ name: (isDef ? 'default:' : '') + n0, kind: k });
    }
  }
  graph[f] = edges;
  exportsOf[f] = exps;
}

const area = files.filter(inArea).sort();
const importers = {};
for (const [f, edges] of Object.entries(graph))
  for (const e of edges) (importers[e.to] ||= []).push({ from: f, names: e.names, typeOnly: e.typeOnly, mock: !!e.mock });

let out = '';
for (const f of area) {
  const lines = fs.readFileSync(f, 'utf8').split('\n').length - 1;
  out += `\n## ${f} (${lines} lines)\n`;
  out += 'exports: ' + exportsOf[f].map((e) => `${e.name}[${e.kind}]`).join(', ') + '\n';
  const imp = (importers[f] || []).filter((i) => i.from !== f);
  const inside = imp.filter((i) => inArea(i.from));
  const outside = imp.filter((i) => !inArea(i.from));
  out += 'importers in area: ' + inside.map((i) => `${i.from}${i.mock ? '(mock)' : ''}{${i.names.join(',')}}`).join('; ') + '\n';
  out += 'importers OUTSIDE: ' + outside.map((i) => `${i.from}${i.mock ? '(mock)' : ''}{${i.names.join(',')}}`).join('; ') + '\n';
  const deps = graph[f].filter((e) => !e.mock).map((e) => `${e.to}{${e.names.join(',')}}`);
  out += 'imports: ' + deps.join('; ') + '\n';
}
fs.writeFileSync(path.join(OUT, 'graph.txt'), out);

// cycles among area files + their direct deps (Tarjan over the whole graph, report SCCs touching area)
const idx = {}, low = {}, onst = {}, st = [];
let i = 0;
const sccs = [];
function strong(v, typeToo) {
  idx[v] = low[v] = i++; st.push(v); onst[v] = true;
  for (const e of graph[v] || []) {
    if (e.mock || e.to.startsWith('UNRESOLVED') || (!typeToo && e.typeOnly)) continue;
    const w = e.to;
    if (!graph[w]) continue;
    if (idx[w] === undefined) { strong(w, typeToo); low[v] = Math.min(low[v], low[w]); }
    else if (onst[w]) low[v] = Math.min(low[v], idx[w]);
  }
  if (low[v] === idx[v]) {
    const c = []; let w;
    do { w = st.pop(); onst[w] = false; c.push(w); } while (w !== v);
    if (c.length > 1) sccs.push(c);
  }
}
let cyc = '';
for (const typeToo of [false, true]) {
  for (const k of Object.keys(idx)) { delete idx[k]; delete low[k]; delete onst[k]; }
  st.length = 0; i = 0; sccs.length = 0;
  for (const f of files) if (idx[f] === undefined) strong(f, typeToo);
  cyc += `\n# cycles (${typeToo ? 'counting type-only' : 'runtime only'}): ${sccs.length}\n`;
  for (const c of sccs) cyc += (c.some(inArea) ? '[AREA] ' : '') + c.join(' <-> ') + '\n';
}
fs.writeFileSync(path.join(OUT, 'cycles.txt'), cyc);
fs.writeFileSync(path.join(OUT, 'graph.json'), JSON.stringify({ graph, exportsOf }, null, 0));
console.log('area files', area.length);
