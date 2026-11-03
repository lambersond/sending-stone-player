// U1 analysis: a rough cognitive-complexity estimate per top-level function (Sonar S3776-like:
// +1 per if/else-if/else/ternary/switch/loop/catch/logical-operator sequence, + nesting for the
// nestable ones; nested functions add nesting and count into their top-level function, as
// eslint-plugin-sonarjs does). Approximate only: exact counts come from WS0's metrics.
// Usage: node complexity.cjs <repoRoot> <file>... ; prints "score file:line name" for score > 10.
const fs = require('node:fs')
const path = require('node:path')
const ts = require(path.join(process.argv[2], 'node_modules/typescript'))
const root = process.argv[2]

function logicalSeqs(node) {
  // count sequences of like operators in a binary-expression tree (&&, ||, ??)
  let count = 0
  const ops = [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken]
  function flat(n, out) {
    if (ts.isParenthesizedExpression(n)) return flat(n.expression, out)
    if (ts.isBinaryExpression(n) && ops.includes(n.operatorToken.kind)) {
      flat(n.left, out); out.push(n.operatorToken.kind); flat(n.right, out)
    }
    return out
  }
  const seq = flat(node, [])
  let prev
  for (const op of seq) { if (op !== prev) count++; prev = op }
  return count
}

function score(fn) {
  let total = 0
  function visit(n, nesting) {
    if (n !== fn && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n))) {
      ts.forEachChild(n, c => visit(c, nesting + 1)); return
    }
    if (ts.isIfStatement(n)) {
      total += 1 + nesting
      visit(n.expression, nesting)
      visit(n.thenStatement, nesting + 1)
      let e = n.elseStatement
      while (e) {
        if (ts.isIfStatement(e)) { total += 1; visit(e.expression, nesting); visit(e.thenStatement, nesting + 1); e = e.elseStatement }
        else { total += 1; visit(e, nesting + 1); e = undefined }
      }
      return
    }
    if (ts.isConditionalExpression(n)) {
      total += 1 + nesting
      visit(n.condition, nesting); visit(n.whenTrue, nesting + 1); visit(n.whenFalse, nesting + 1); return
    }
    if (ts.isSwitchStatement(n) || ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n) || ts.isCatchClause(n)) {
      total += 1 + nesting
      ts.forEachChild(n, c => visit(c, nesting + 1)); return
    }
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) {
      const parent = n.parent && ts.isParenthesizedExpression(n.parent) ? n.parent.parent : n.parent
      const isRoot = !(parent && ts.isBinaryExpression(parent) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind))
      if (isRoot) total += logicalSeqs(n)
    }
    ts.forEachChild(n, c => visit(c, nesting))
  }
  ts.forEachChild(fn, c => visit(c, 0))
  return total
}

for (const file of process.argv.slice(3)) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const rel = path.relative(root, path.resolve(file))
  for (const st of src.statements) {
    let fn, name
    if (ts.isFunctionDeclaration(st) && st.body) { fn = st; name = st.name?.text }
    else if (ts.isVariableStatement(st)) {
      const d = st.declarationList.declarations[0]
      if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) { fn = d.initializer; name = d.name.getText(src) }
    }
    if (!fn) continue
    const s = score(fn)
    const line = src.getLineAndCharacterOfPosition(st.getStart()).line + 1
    if (s > 10) console.log(`${String(s).padStart(4)} ${rel}:${line} ${name}`)
  }
}
