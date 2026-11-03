// Map W: every switch, comparison, map, set or list keyed on a request kind (ROLL_KINDS) in src/**.
// Usage: node .refactor/analysis/W/kinds.cjs [--tests] > <out>
// A site is: a switch with 2+ case labels that are request kinds; a `x.kind ===/!== 'K'` or
// `kind ===/!== 'K'` comparison; an object literal with 3+ keys that are kinds; an array/Set literal
// with 3+ kind strings; a type `Record<RollKind, …>` / `Extract<RollKind…>`; `.includes(kind)`/`.has(kind)`.
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const withTests = process.argv.includes('--tests');
const constText = fs.readFileSync(path.join(ROOT, 'src/constants/sending-stone.ts'), 'utf8');
const KINDS = new Set(constText.match(/ROLL_KINDS = \[([\s\S]*?)\] as const/)[1].match(/'(\w+)'/g).map((s) => s.slice(1, -1)));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && (withTests || !/\.test\.|test-utils|\/mocks\//.test(p))) out.push(p);
  }
  return out;
}
const str = (n) => (n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined);
const out = [];
for (const f of walk(path.join(ROOT, 'src'))) {
  const text = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const r = path.relative(ROOT, f);
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const fn = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if ((ts.isFunctionDeclaration(p) || ts.isMethodDeclaration(p)) && p.name) return p.name.getText(sf);
      if (ts.isVariableDeclaration(p) && p.name) return p.name.getText(sf).replace(/\s+/g, ' ').slice(0, 30);
    }
    return '-';
  };
  const visit = (n) => {
    if (ts.isSwitchStatement(n)) {
      const labels = n.caseBlock.clauses.filter(ts.isCaseClause).map((c) => str(c.expression)).filter(Boolean);
      const k = labels.filter((l) => KINDS.has(l));
      if (k.length >= 2) out.push(`${r}:${line(n)}\tswitch\t${fn(n)}\t${n.expression.getText(sf)}\t${k.length}/${labels.length}\t${k.join(',')}`);
    }
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(n.operatorToken.kind)) {
      const s = str(n.right) ?? str(n.left);
      const other = str(n.right) ? n.left : n.right;
      if (s && KINDS.has(s) && /kind\b|Kind\b|rolled\b/.test(other.getText(sf))) out.push(`${r}:${line(n)}\tcompare\t${fn(n)}\t${other.getText(sf)}\t${n.operatorToken.getText(sf)}\t${s}`);
    }
    if (ts.isObjectLiteralExpression(n)) {
      const keys = n.properties.map((p) => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : undefined).filter(Boolean);
      const k = keys.filter((x) => KINDS.has(x));
      if (k.length >= 3) out.push(`${r}:${line(n)}\tobject\t${fn(n)}\t-\t${k.length}/${keys.length}\t${k.join(',')}`);
    }
    if (ts.isArrayLiteralExpression(n)) {
      const vals = n.elements.map(str).filter(Boolean);
      const k = vals.filter((x) => KINDS.has(x));
      if (k.length >= 3 && !(r === 'src/constants/sending-stone.ts' && fn(n) === 'ROLL_KINDS')) out.push(`${r}:${line(n)}\tlist\t${fn(n)}\t-\t${k.length}/${vals.length}\t${k.join(',')}`);
    }
    if (ts.isTypeReferenceNode(n) && /^(Record|Extract|Exclude)$/.test(n.typeName.getText(sf)) && n.typeArguments && /RollKind/.test(n.typeArguments[0].getText(sf))) {
      out.push(`${r}:${line(n)}\ttype\t${fn(n)}\t${n.getText(sf).slice(0, 60)}\t-\t-`);
    }
    if (ts.isUnionTypeNode(n)) {
      const lits = n.types.filter(ts.isLiteralTypeNode).map((t) => str(t.literal)).filter(Boolean);
      const k = lits.filter((x) => KINDS.has(x));
      if (k.length >= 3) out.push(`${r}:${line(n)}\tunion\t${fn(n)}\t-\t${k.length}/${lits.length}\t${k.join(',')}`);
    }
    if (ts.isCallExpression(n) && n.arguments.length === 1 && KINDS.has(str(n.arguments[0]) || '') && /(kinds|Kinds|takes|lists)\b|\.includes$/.test(n.expression.getText(sf)) && /kinds|Kinds|takes|lists/.test(n.expression.getText(sf))) {
      out.push(`${r}:${line(n)}\tgate\t${fn(n)}\t${n.expression.getText(sf).replace(/\s+/g, '')}\t-\t${str(n.arguments[0])}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
console.log(out.join('\n'));
