// Rough cognitive complexity (Sonar-like) per function, for the files given; prints those > 15.
// Usage: node .refactor/analysis/S/complexity.cjs <files...>
// Approximation: +1(+nesting) for if, ternary, switch, loops, catch; +1 for else/else-if; +1 per
// run of the same logical operator (&&, ||, ??); nested functions raise nesting. WS0's sonarjs
// counts are the real ones.
const fs = require('fs')
const ts = require('typescript')
const K = ts.SyntaxKind
const out = []
for (const f of process.argv.slice(2)) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true)
  const fnName = (n) => {
    if (n.name && n.name.getText) return n.name.getText(sf)
    const p = n.parent
    if (p && ts.isVariableDeclaration(p)) return p.name.getText(sf)
    if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf)
    if (p && ts.isCallExpression(p)) return `<cb of ${p.expression.getText(sf).slice(0, 30)}>`
    return '<anon>'
  }
  const isFn = (n) => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
  function score(fn) {
    let total = 0
    const logical = (n) => {
      // count operator runs in a binary chain
      const ops = []
      const flat = (e) => {
        if (ts.isParenthesizedExpression(e)) return flat(e.expression)
        if (ts.isBinaryExpression(e) && [K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken].includes(e.operatorToken.kind)) {
          flat(e.left); ops.push(e.operatorToken.kind); flat(e.right)
        }
      }
      flat(n)
      let runs = 0
      for (let i = 0; i < ops.length; i++) if (i === 0 || ops[i] !== ops[i - 1]) runs++
      return runs
    }
    const walk = (n, nest, isTopFn) => {
      if (!isTopFn && isFn(n)) { ts.forEachChild(n, (c) => walk(c, nest + 1, false)); return }
      if (ts.isIfStatement(n)) {
        const isElseIf = n.parent && ts.isIfStatement(n.parent) && n.parent.elseStatement === n
        total += isElseIf ? 1 : 1 + nest
        walk(n.expression, nest, false)
        walk(n.thenStatement, nest + 1, false)
        if (n.elseStatement) {
          if (ts.isIfStatement(n.elseStatement)) walk(n.elseStatement, nest, false)
          else { total += 1; walk(n.elseStatement, nest + 1, false) }
        }
        return
      }
      if (ts.isConditionalExpression(n)) { total += 1 + nest; walk(n.condition, nest, false); walk(n.whenTrue, nest + 1, false); walk(n.whenFalse, nest + 1, false); return }
      if (ts.isSwitchStatement(n)) { total += 1 + nest; walk(n.expression, nest, false); n.caseBlock.clauses.forEach((c) => walk(c, nest + 1, false)); return }
      if (ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n)) {
        total += 1 + nest; ts.forEachChild(n, (c) => walk(c, c === n.statement ? nest + 1 : nest, false)); return
      }
      if (ts.isCatchClause(n)) { total += 1 + nest; ts.forEachChild(n, (c) => walk(c, nest + 1, false)); return }
      if (ts.isBinaryExpression(n) && [K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken].includes(n.operatorToken.kind)) {
        const p = n.parent
        const parentIsLogical = p && (ts.isBinaryExpression(p) && [K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken].includes(p.operatorToken.kind))
          || (p && ts.isParenthesizedExpression(p) && p.parent && ts.isBinaryExpression(p.parent) && [K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken].includes(p.parent.operatorToken.kind))
        if (!parentIsLogical) total += logical(n)
      }
      ts.forEachChild(n, (c) => walk(c, nest, false))
    }
    walk(fn, 0, true)
    return total
  }
  const visit = (n, depth) => {
    if (isFn(n) && depth === 0) {
      const s = score(n)
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
      if (s > 15) out.push([s, `${f}:${line}`, fnName(n)])
      ts.forEachChild(n, (c) => visit(c, 1))
      return
    }
    ts.forEachChild(n, (c) => visit(c, isFn(n) ? depth + 1 : depth))
  }
  visit(sf, 0)
}
out.sort((a, b) => b[0] - a[0])
for (const r of out) console.log(r.join('\t'))
