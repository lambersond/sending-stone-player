// Map W: every zod `.catch(<fallback>)` in src/schemas/*.ts (not tests), clustered by the shape of
// the chain it ends, to size the lenient helpers (decisions Q2).
// Usage: node .refactor/analysis/W/fallbacks.cjs [--lines] > <out>
const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const dir = path.join(ROOT, 'src/schemas');
const showLines = process.argv.includes('--lines');
const clusters = {};
for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.ts') && !n.includes('.test.'))) {
  const f = path.join(dir, name);
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'catch') {
      const arg = n.arguments[0] ? n.arguments[0].getText(sf).replace(/\s+/g, ' ') : '';
      // The chain's method names, outermost last: z.string().max(80).nullable() -> string.max.nullable
      const names = [];
      let e = n.expression.expression;
      while (e) {
        if (ts.isCallExpression(e)) e = e.expression;
        else if (ts.isPropertyAccessExpression(e)) { names.unshift(e.name.text); e = e.expression; }
        else { names.unshift(ts.isIdentifier(e) ? e.text : '?'); break; }
      }
      const base = names[0] === 'z' ? names[1] : names[0].replace(/Schema$/, 'Schema');
      const tail = names.filter((x) => ['nullable', 'optional', 'nullish', 'default'].includes(x)).join('.');
      const key = `${arg.length > 30 ? arg.slice(0, 30) + '…' : arg}\t${names[0] === 'z' ? 'z.' + base : 'schema'}\t${tail || '-'}`;
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      (clusters[key] ||= []).push(`${name}:${line}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const rows = Object.entries(clusters).sort((a, b) => b[1].length - a[1].length);
for (const [k, v] of rows) console.log(`${v.length}\t${k}${showLines ? '\t' + v.join(' ') : ''}`);
