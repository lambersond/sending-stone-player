// Approximate SonarJS cognitive complexity per function (top-level and nested named functions).
// Usage: node complexity.cjs <files...>  -> "file:line name score" for score > 15, plus per-function sizes with --all
const ts = require('typescript')
const fs = require('fs')
const all = process.argv.includes('--all')
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))

function score(fnNode, sf) {
  let total = 0
  function logical(n) {
    // count sequences of like operators: a && b && c = +1, a && b || c = +2
    const ops = []
    ;(function flat(e) {
      if (ts.isBinaryExpression(e) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) {
        flat(e.left); ops.push(e.operatorToken.kind); flat(e.right)
      } else if (ts.isParenthesizedExpression(e)) flat(e.expression)
    })(n)
    let c = 0, prev
    for (const o of ops) { if (o !== prev) c++; prev = o }
    return c
  }
  function visit(n, nest) {
    // nested function: increases nesting, not counted itself
    if (n !== fnNode && (ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n))) {
      n.forEachChild((c) => visit(c, nest + 1)); return
    }
    if (ts.isIfStatement(n)) {
      total += 1 + nest
      visit(n.expression, nest)
      visit(n.thenStatement, nest + 1)
      let e = n.elseStatement
      while (e) {
        if (ts.isIfStatement(e)) { total += 1; visit(e.expression, nest); visit(e.thenStatement, nest + 1); e = e.elseStatement }
        else { total += 1; visit(e, nest + 1); e = undefined }
      }
      return
    }
    if (ts.isConditionalExpression(n)) { total += 1 + nest; visit(n.condition, nest); visit(n.whenTrue, nest + 1); visit(n.whenFalse, nest + 1); return }
    if (ts.isSwitchStatement(n)) { total += 1 + nest; visit(n.expression, nest); n.caseBlock.forEachChild((c) => visit(c, nest + 1)); return }
    if (ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) {
      total += 1 + nest; n.forEachChild((c) => visit(c, c === n.statement ? nest + 1 : nest)); return
    }
    if (ts.isCatchClause(n)) { total += 1 + nest; n.forEachChild((c) => visit(c, nest + 1)); return }
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind)) {
      // only count at the root of a logical chain
      const p = n.parent
      const isRoot = !(p && ts.isBinaryExpression(p) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind)) && !(p && ts.isParenthesizedExpression(p) && p.parent && ts.isBinaryExpression(p.parent))
      if (isRoot) total += logical(n)
      n.forEachChild((c) => visit(c, nest)); return
    }
    if ((ts.isBreakStatement(n) || ts.isContinueStatement(n)) && n.label) total += 1
    n.forEachChild((c) => visit(c, nest))
  }
  fnNode.forEachChild((c) => visit(c, 0))
  return total
}

for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const endLine = (n) => sf.getLineAndCharacterOfPosition(n.getEnd()).line + 1
  function named(n) {
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.parent && ts.isVariableDeclaration(n.parent)) return n.parent.name.getText()
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.parent && ts.isPropertyAssignment(n.parent)) return n.parent.name.getText()
    if (ts.isMethodDeclaration(n)) return n.name.getText()
    return undefined
  }
  ;(function walk(n, depth) {
    const nm = named(n)
    if (nm && depth <= 1) {
      // Sonar scores each top-level function including nested callbacks' structures (nesting +1)
      const s = score(n, sf)
      if (all || s > 15) console.log(`${f.replace(/^.*src\//, '')}:${line(n)} ${nm} cc~${s} lines=${endLine(n) - line(n) + 1}`)
      n.forEachChild((c) => walk(c, depth + 1))
      return
    }
    n.forEachChild((c) => walk(c, depth))
  })(sf, 0)
}
