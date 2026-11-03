// V1's rough cognitive-complexity estimate (Sonar's rules, approximated with the TS AST): per
// top-level function and per named nested function, the score including nested functions (as
// SonarJS attributes them to the top level) and the function's own. Exact counts are WS0's.
// Usage: node cognitive.cjs <file>...  (read-only)
const ts = require('/home/user/sending-stone-player/node_modules/typescript')
const fs = require('fs')
const K = ts.SyntaxKind
const out = []
for (const file of process.argv.slice(2)) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const isFn = n => [K.FunctionDeclaration, K.FunctionExpression, K.ArrowFunction, K.MethodDeclaration].includes(n.kind)
  const nameOf = n => {
    if (n.name) return n.name.getText()
    const p = n.parent
    if (p && p.kind === K.VariableDeclaration) return p.name.getText()
    if (p && p.kind === K.PropertyAssignment) return p.name.getText()
    return undefined
  }
  // score(node, nesting): own complexity of a function body, nested functions included or not
  function score(node, nesting, withNested) {
    let total = 0
    const visit = (n, level) => {
      if (n !== node && isFn(n)) { if (withNested) ts.forEachChild(n, c => visit(c, level + 1)); return }
      switch (n.kind) {
        case K.IfStatement: {
          const isElseIf = n.parent.kind === K.IfStatement && n.parent.elseStatement === n
          total += isElseIf ? 1 : 1 + level
          visit(n.expression, level)
          visit(n.thenStatement, level + 1)
          if (n.elseStatement) {
            if (n.elseStatement.kind === K.IfStatement) visit(n.elseStatement, level)
            else { total += 1; visit(n.elseStatement, level + 1) }
          }
          return
        }
        case K.ConditionalExpression:
          total += 1 + level
          visit(n.condition, level); visit(n.whenTrue, level + 1); visit(n.whenFalse, level + 1)
          return
        case K.SwitchStatement: case K.ForStatement: case K.ForInStatement: case K.ForOfStatement:
        case K.WhileStatement: case K.DoStatement: case K.CatchClause:
          total += 1 + level
          ts.forEachChild(n, c => visit(c, level + 1))
          return
        case K.BinaryExpression: {
          const op = n.operatorToken.kind
          if ([K.AmpersandAmpersandToken, K.BarBarToken, K.QuestionQuestionToken].includes(op)) {
            const p = n.parent
            const sameAsParent = p && p.kind === K.BinaryExpression && p.operatorToken.kind === op
            if (!sameAsParent) total += 1
          }
          break
        }
      }
      ts.forEachChild(n, c => visit(c, level))
    }
    ts.forEachChild(node, c => visit(c, nesting))
    return total
  }
  // SonarJS: a top-level function that is a React component (capitalised, returns JSX), or has no
  // structural complexity of its own, is scored alone and each second-level function on its own;
  // any other top-level function is scored with its nested functions included.
  const hasJsx = n => { let f = false; const v = c => { if (f) return; if ([K.JsxElement, K.JsxSelfClosingElement, K.JsxFragment].includes(c.kind)) f = true; else ts.forEachChild(c, v) }; ts.forEachChild(n, v); return f }
  const structural = n => { let f = false; const v = c => { if (f || isFn(c)) return; if ([K.IfStatement, K.ConditionalExpression, K.SwitchStatement, K.ForStatement, K.ForInStatement, K.ForOfStatement, K.WhileStatement, K.DoStatement, K.CatchClause].includes(c.kind)) f = true; else ts.forEachChild(c, v) }; ts.forEachChild(n, v); return f }
  const lineOf = n => src.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const seconds = (top) => { const r = []; const v = c => { if (isFn(c)) { r.push(c); return } ts.forEachChild(c, v) }; ts.forEachChild(top, v); return r }
  const tops = []; const findTops = n => { if (isFn(n)) { tops.push(n); return } ts.forEachChild(n, findTops) }; findTops(src)
  for (const top of tops) {
    const name = nameOf(top) || '(anon)'
    const component = /^[A-Z]/.test(name) && hasJsx(top)
    if (!component && structural(top)) {
      out.push({ file, line: lineOf(top), name, all: score(top, 0, true), own: score(top, 0, false), top: true })
    } else {
      out.push({ file, line: lineOf(top), name: name + (component ? ' [component]' : ''), all: score(top, 0, false), own: score(top, 0, false), top: true })
      for (const sec of seconds(top)) out.push({ file, line: lineOf(sec), name: `${name} > ${nameOf(sec) || '(anon)'}`, all: score(sec, 0, true), own: score(sec, 0, false), top: false })
    }
  }
}
out.sort((a, b) => b.all - a.all)
for (const r of out) if (r.all > 10) console.log(`${String(r.all).padStart(4)} ${String(r.own).padStart(4)} ${r.top ? 'top ' : 'nest'} ${r.file}:${r.line} ${r.name}`)
