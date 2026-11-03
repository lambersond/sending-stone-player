// Gate 7, shims (round.md §3.4, SA F2): no `v0.43-shim` comment; no re-export-only module (only
// `export … from` statements) but the base's barrels, which commit 5 deletes; and no `export … from`
// of a name that moved after 24f808b (moves.tsv `name` rows), a re-export a move left behind;
// except files in shims.allow (`path<TAB>reason`; expected empty, and empty again after commit 23).
import ts from 'typescript'
import { gate, isSource, movedNames, readAllow, verdict } from './gate-lib.mjs'

gate('7', checkout => {
  const problems = []
  const allowed = new Set(readAllow('shims.allow').map(([file]) => file))
  const moved = movedNames()
  const files = checkout.files.filter(file => file.startsWith('src/') && isSource(file))
  const baseOnly = file => {
    const base = checkout.base(file)
    if (!base) return false
    const text = checkout.baseText(base)
    return text !== undefined && reexportOnly(ts.createSourceFile(base, text, ts.ScriptTarget.Latest, true))
  }
  let barrels = 0
  for (const file of files) {
    if (allowed.has(file)) continue
    const text = checkout.text(file)
    if (text.includes('v0.43-shim')) problems.push(`${file}: a v0.43-shim comment`)
    const sf = checkout.parse(file)
    if (reexportOnly(sf)) {
      if (baseOnly(file)) barrels += 1
      else problems.push(`${file}: a module of re-exports only`)
    }
    for (const statement of sf.statements) {
      if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) continue
      const clause = statement.exportClause
      if (!clause || ts.isNamespaceExport(clause)) continue
      for (const element of clause.elements) {
        const name = (element.propertyName ?? element.name).text
        if (moved.has(name)) problems.push(`${file}: re-exports ${name}, a name that moved`)
      }
    }
  }
  return verdict(problems, `${files.length} modules; ${barrels} base barrels left; ${moved.size} moved names`)
})

function reexportOnly(sf) {
  const statements = sf.statements
  return (
    statements.length > 0 &&
    statements.every(s => ts.isExportDeclaration(s) && s.moduleSpecifier !== undefined)
  )
}
