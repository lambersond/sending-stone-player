// Mapper R: approximate Sonar cognitive complexity per function (TS AST).
// own = the function alone (nested functions excluded); agg = sonarjs's way, where a nested
// function's points count toward its enclosing function at nesting +1.
// Usage: node .refactor/analysis/R/complexity.cjs <threshold> <files...>
const fs = require('fs');
const ts = require('typescript');

const [threshold, ...files] = process.argv.slice(2);
const K = ts.SyntaxKind;
const isFn = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isGetAccessor(n) || ts.isSetAccessor(n) || ts.isConstructorDeclaration(n);
const LOGICAL = new Set([K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken]);
const isLogical = (e) => e && ts.isBinaryExpression(e) && LOGICAL.has(e.operatorToken.kind);
const unparen = (e) => { while (e && ts.isParenthesizedExpression(e)) e = e.parent; return e; };

function nameOf(n, sf) {
  if (n.name && n.name.getText) return n.name.getText(sf);
  const p = n.parent;
  if (p && ts.isVariableDeclaration(p)) return p.name.getText(sf);
  if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf);
  if (p && ts.isCallExpression(p)) {
    const gp = p.parent;
    const callee = p.expression.getText(sf).slice(0, 30);
    if (gp && ts.isVariableDeclaration(gp)) return gp.name.getText(sf) + '=' + callee;
    return '(' + callee + ' arg)';
  }
  return '<anon>';
}
function sequences(n) {
  const ops = [];
  const walk = (e) => {
    while (ts.isParenthesizedExpression(e)) e = e.expression;
    if (isLogical(e)) { walk(e.left); ops.push(e.operatorToken.kind); walk(e.right); }
  };
  walk(n);
  let c = 0, prev;
  for (const o of ops) { if (o !== prev) c++; prev = o; }
  return c;
}
// score a function's body: returns { own, agg }
function score(fn) {
  let own = 0, agg = 0;
  const add = (v, inNested) => { agg += v; if (!inNested) own += v; };
  const visit = (n, nesting, inNested) => {
    if (n !== fn && isFn(n)) {
      ts.forEachChild(n, (c) => visit(c, nesting + 1, true));
      return;
    }
    if (ts.isIfStatement(n)) {
      const elseIf = ts.isIfStatement(n.parent) && n.parent.elseStatement === n;
      add(elseIf ? 1 : 1 + nesting, inNested);
      visit(n.expression, nesting, inNested);
      visit(n.thenStatement, nesting + 1, inNested);
      if (n.elseStatement) {
        if (ts.isIfStatement(n.elseStatement)) visit(n.elseStatement, nesting, inNested);
        else { add(1, inNested); visit(n.elseStatement, nesting + 1, inNested); }
      }
      return;
    }
    if (ts.isConditionalExpression(n)) {
      add(1 + nesting, inNested);
      visit(n.condition, nesting, inNested);
      visit(n.whenTrue, nesting + 1, inNested);
      visit(n.whenFalse, nesting + 1, inNested);
      return;
    }
    let nest = false;
    if (ts.isSwitchStatement(n) || ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n) || ts.isCatchClause(n)) {
      add(1 + nesting, inNested); nest = true;
    }
    if (isLogical(n)) {
      let p = n.parent; while (p && ts.isParenthesizedExpression(p)) p = p.parent;
      if (!isLogical(p)) add(sequences(n), inNested);
    }
    if ((ts.isBreakStatement(n) || ts.isContinueStatement(n)) && n.label) add(1, inNested);
    ts.forEachChild(n, (c) => visit(c, nest ? nesting + 1 : nesting, inNested));
  };
  ts.forEachChild(fn, (c) => visit(c, 0, false));
  return { own, agg };
}

const results = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const walk = (n, depth) => {
    if (isFn(n)) {
      const { own, agg } = score(n);
      const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
      results.push({ file: f, line: line + 1, name: nameOf(n, sf), own, agg, top: depth === 0 });
      ts.forEachChild(n, (c) => walk(c, depth + 1));
      return;
    }
    ts.forEachChild(n, (c) => walk(c, depth));
  };
  walk(sf, 0);
}
const t = Number(threshold);
const hot = results.filter((r) => (r.top ? r.agg : r.own) > t);
hot.sort((a, b) => (b.top ? b.agg : b.own) - (a.top ? a.agg : a.own));
for (const r of hot) console.log(`${r.file}:${r.line}\t${r.name}\t${r.top ? 'top' : 'nested'}\town=${r.own}\tagg=${r.agg}`);
console.log(`# functions ${results.length}; top-level with agg>${t}: ${results.filter((r) => r.top && r.agg > t).length}; any function with own>${t}: ${results.filter((r) => r.own > t).length}`);
