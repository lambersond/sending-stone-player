// Map W: exports of each file in W's area and its importers outside the area.
// Usage: node .refactor/analysis/W/edges.cjs > <out>
// Read-only; parses src/** with the TypeScript compiler API (no type check).
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const AREA = [/^src\/schemas\//, /^src\/types\//, /^src\/constants\//, /^src\/mocks\//, /^src\/utils\/roll-requests(\.test)?\.ts$/];
const inArea = (rel) => AREA.some((r) => r.test(rel));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(SRC).concat(fs.existsSync(path.join(ROOT, 'e2e')) ? walk(path.join(ROOT, 'e2e')) : []);
const rel = (p) => path.relative(ROOT, p);

function resolve(spec, from) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec === '@test-utils') base = path.join(SRC, 'utils/test-utils');
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const c of [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const exportsOf = {};
const importers = {}; // target -> [{from, names, typeOnly, how}]
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const r = rel(f);
  const exps = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const t = resolve(node.moduleSpecifier.text, f);
      if (t) {
        let names = [];
        let typeOnly = false;
        if (ts.isImportDeclaration(node) && node.importClause) {
          typeOnly = !!node.importClause.isTypeOnly;
          if (node.importClause.name) names.push('default');
          const nb = node.importClause.namedBindings;
          if (nb && ts.isNamedImports(nb)) names.push(...nb.elements.map((e) => (e.isTypeOnly ? 'type ' : '') + (e.propertyName || e.name).text));
          if (nb && ts.isNamespaceImport(nb)) names.push('* as ' + nb.name.text);
        }
        if (ts.isExportDeclaration(node)) {
          typeOnly = node.isTypeOnly;
          if (node.exportClause && ts.isNamedExports(node.exportClause)) names.push(...node.exportClause.elements.map((e) => 're:' + (e.propertyName || e.name).text));
          else names.push('re:*');
        }
        (importers[t] ||= []).push({ from: r, names, typeOnly, how: ts.isImportDeclaration(node) ? 'import' : 'export-from' });
      }
    }
    if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteral(node.arguments[0])) {
      const callee = node.expression.getText(sf);
      if (/^(jest\.(mock|requireActual|requireMock|doMock)|require|import)$/.test(callee) || node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const t = resolve(node.arguments[0].text, f);
        if (t) (importers[t] ||= []).push({ from: r, names: [callee], typeOnly: false, how: callee });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (inArea(r)) {
    for (const st of sf.statements) {
      const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) || [] : [];
      if (!mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isExportDeclaration(st)) exps.push('re-export ' + st.getText(sf).replace(/\s+/g, ' ').slice(0, 80));
        continue;
      }
      const kind = ts.SyntaxKind[st.kind].replace(/Declaration|Statement/, '');
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) exps.push('const ' + d.name.getText(sf));
      else exps.push(kind + ' ' + (st.name ? st.name.getText(sf) : 'default'));
    }
    exportsOf[r] = exps;
  }
}

for (const r of Object.keys(exportsOf).sort()) {
  const abs = path.join(ROOT, r);
  const lines = fs.readFileSync(abs, 'utf8').split('\n').length;
  const imps = (importers[abs] || []).filter((i) => !inArea(i.from));
  const inside = (importers[abs] || []).filter((i) => inArea(i.from));
  const kinds = {};
  for (const e of exportsOf[r]) { const k = e.split(' ')[0]; kinds[k] = (kinds[k] || 0) + 1; }
  console.log(`## ${r} (${lines} lines) exports ${exportsOf[r].length} ${JSON.stringify(kinds)}`);
  console.log('  exports: ' + exportsOf[r].join(', '));
  console.log(`  importers in area: ${inside.length}; outside: ${new Set(imps.map((i) => i.from)).size}`);
  const byName = {};
  for (const i of imps) for (const n of i.names) (byName[n.replace(/^type /, '')] ||= new Set()).add(i.from);
  for (const [n, s] of Object.entries(byName).sort((a, b) => b[1].size - a[1].size)) {
    console.log(`    ${n}: ${s.size} ${[...s].slice(0, 6).join(' ')}${s.size > 6 ? ' …' : ''}`);
  }
}
