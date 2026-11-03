// Rough cognitive complexity (SonarJS-like) per outermost function; nested functions add to their
// enclosing function at nesting+1 (as sonarjs does). Approximation only: WS0's metrics are exact.
// usage: node cc.cjs <repoRoot> <file...>
const fs = require('fs')
const path = require('path')
const ts = require(path.join(process.argv[2], 'node_modules/typescript'))
const K = ts.SyntaxKind
const isFn = n => ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
for (const f of process.argv.slice(3)) {
  const text = fs.readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const res = []
  const nameOf = n => {
    if (n.name) return n.name.getText(sf)
    const p = n.parent
    if (p && ts.isVariableDeclaration(p)) return p.name.getText(sf)
    if (p && ts.isPropertyAssignment(p)) return p.name.getText(sf)
    if (p && ts.isCallExpression(p)) return p.expression.getText(sf).slice(0, 30) + '(cb)'
    return '(anon)'
  }
  function score(fn) {
    let total = 0
    const logical = (n) => {
      // count sequences of && / || / ?? : one per change of operator in a flattened chain
      const ops = []
      ;(function flat(m) {
        if (ts.isBinaryExpression(m) && [K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken].includes(m.operatorToken.kind)) { flat(m.left); ops.push(m.operatorToken.kind); flat(m.right) }
        else if (ts.isParenthesizedExpression(m)) flat(m.expression)
      })(n)
      let c = 0
      for (let i = 0; i < ops.length; i++) if (i === 0 || ops[i] !== ops[i - 1]) c++
      return c
    }
    function visit(n, nest) {
      if (n !== fn && isFn(n)) { ts.forEachChild(n, c => visit(c, nest + 1)); return }
      if (ts.isIfStatement(n)) {
        const isElseIf = n.parent && ts.isIfStatement(n.parent) && n.parent.elseStatement === n
        total += isElseIf ? 1 : 1 + nest
        visit(n.expression, nest)
        visit(n.thenStatement, nest + 1)
        if (n.elseStatement) {
          if (ts.isIfStatement(n.elseStatement)) visit(n.elseStatement, nest)
          else { total += 1; visit(n.elseStatement, nest + 1) }
        }
        return
      }
      if (ts.isConditionalExpression(n)) { total += 1 + nest; visit(n.condition, nest); visit(n.whenTrue, nest + 1); visit(n.whenFalse, nest + 1); return }
      if (ts.isSwitchStatement(n) || ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n) || ts.isWhileStatement(n) || ts.isDoStatement(n) || ts.isCatchClause(n)) {
        total += 1 + nest
        ts.forEachChild(n, c => visit(c, nest + 1))
        return
      }
      if (ts.isBinaryExpression(n) && [K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken].includes(n.operatorToken.kind)) {
        const p = n.parent
        const parentIsLogical = p && ts.isBinaryExpression(p) && [K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken].includes(p.operatorToken.kind)
        const inParen = p && ts.isParenthesizedExpression(p) && p.parent && ts.isBinaryExpression(p.parent) && [K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken].includes(p.parent.operatorToken.kind)
        if (!parentIsLogical && !inParen) total += logical(n)
      }
      ts.forEachChild(n, c => visit(c, nest))
    }
    ts.forEachChild(fn, c => visit(c, 0))
    return total
  }
  ;(function walk(n, insideFn) {
    if (isFn(n) && !insideFn) {
      const s = score(n)
      res.push({ name: nameOf(n), line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, s })
      return
    }
    ts.forEachChild(n, c => walk(c, insideFn))
  })(sf, false)
  for (const r of res) if (r.s > 15) console.log(`${path.relative(process.argv[2], f)}:${r.line}\t${r.name}\t${r.s}`)
}
