// Metrics from `eslint . -f json`: warnings per folder per rule (the ratchet) and complexity.
import fs from 'node:fs'
import path from 'node:path'
import { count, folderOf, parseFile, ROOT, visit } from './lib.mjs'

// The checks commit 1 hosts in no-restricted-syntax, by the start of their messages.
const SYNTAX_CHECKS = [
  ['one-export', 'A .tsx file exports one thing'],
  ['hook-export', 'A .tsx file exports no hook'],
  ['utility-export', 'A .tsx file exports only a PascalCase component'],
  ['type-export', 'A .tsx file exports no type'],
  ['tsx-type', 'Named types and interfaces go in a types.ts, not a .tsx'],
  ['ts-type-export', 'Exported named types go in a types.ts'],
]

export const syntaxCheck = message =>
  SYNTAX_CHECKS.find(([, start]) => message.startsWith(start))?.[0] ?? 'other'

export function readLint(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8')).map(result => ({
    file: path.relative(ROOT, result.filePath),
    messages: result.messages,
    errors: result.errorCount,
    warnings: result.warningCount,
  }))
}

const sortedObject = map =>
  Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)))

// { folder: { rule: warnings } } plus no-restricted-syntax split by check, and totals.
export function ratchet(results) {
  const byFolder = new Map()
  const bySyntaxCheck = new Map()
  const totals = { files: results.length, errors: 0, warnings: 0 }
  for (const { file, messages, errors, warnings } of results) {
    totals.errors += errors
    totals.warnings += warnings
    const folder = folderOf(file)
    for (const message of messages) {
      if (message.severity !== 1) continue
      const rule = message.ruleId ?? '(no rule)'
      if (!byFolder.has(folder)) byFolder.set(folder, new Map())
      count(byFolder.get(folder), rule)
      if (rule === 'no-restricted-syntax') {
        if (!bySyntaxCheck.has(folder)) bySyntaxCheck.set(folder, new Map())
        count(bySyntaxCheck.get(folder), syntaxCheck(message.message))
      }
    }
  }
  const nested = map =>
    sortedObject(new Map([...map].map(([key, inner]) => [key, sortedObject(inner)])))
  return { totals, byFolder: nested(byFolder), noRestrictedSyntaxByCheck: nested(bySyntaxCheck) }
}

const FUNCTION = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])
const KEYED = new Set(['Property', 'MethodDefinition', 'PropertyDefinition'])

const keyName = key => key?.name ?? key?.value ?? '[computed]'

function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression') return `.${keyName(callee.property)}`
  return '(call)'
}

function ownName(node, parent) {
  if (node.id?.name) return node.id.name
  if (!parent) return undefined
  if (parent.type === 'VariableDeclarator') return keyName(parent.id)
  if (KEYED.has(parent.type)) return keyName(parent.key)
  if (parent.type === 'AssignmentExpression') return keyName(parent.left.property ?? parent.left)
  if (parent.type === 'ExportDefaultDeclaration') return 'default'
  if (parent.type === 'CallExpression') return `${calleeName(parent.callee)} callback`
  return undefined
}

// Each function's name ("useEffect callback in usePane" for unnamed ones) and where it is.
function functionsOf(file) {
  const parents = new Map()
  const found = []
  visit(parseFile(file), (node, parent) => {
    parents.set(node, parent)
    if (FUNCTION.has(node.type)) found.push(node)
  })
  const nameOf = node => ownName(node, parents.get(node))
  return found.map(node => {
    const parent = parents.get(node)
    const start = KEYED.has(parent?.type) ? parent.loc.start : node.loc.start
    let name = nameOf(node) ?? '(anonymous)'
    if (!node.id && parent?.type !== 'VariableDeclarator' && !KEYED.has(parent?.type)) {
      for (let up = parents.get(node); up; up = parents.get(up)) {
        if (FUNCTION.has(up.type) && nameOf(up)) {
          name += ` in ${nameOf(up)}`
          break
        }
      }
    }
    return { node, name, start, end: node.loc.end }
  })
}

const within = ({ start, end }, line, column) =>
  (line > start.line || (line === start.line && column >= start.column)) &&
  (line < end.line || (line === end.line && column <= end.column))

const COMPLEXITY = /Cognitive Complexity from (\d+) to the (\d+) allowed/

// Every function sonarjs/cognitive-complexity reports, with its score, sorted by score.
export function complexity(results) {
  const rows = []
  for (const { file, messages } of results) {
    const reports = messages.filter(m => m.ruleId === 'sonarjs/cognitive-complexity')
    if (reports.length === 0) continue
    const functions = functionsOf(file)
    for (const report of reports) {
      const column = report.column - 1
      const holders = functions.filter(f => within(f, report.line, column))
      const innermost = holders.at(-1)
      rows.push({
        file,
        line: report.line,
        name: innermost?.name ?? '(not found)',
        score: Number(COMPLEXITY.exec(report.message)?.[1] ?? 0),
      })
    }
  }
  return rows.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file) || a.line - b.line)
}
