// Shared helpers for the v0.43 metrics: the repo's source files, parsing, module resolution.
import fs from 'node:fs'
import path from 'node:path'
import { parse } from '@typescript-eslint/typescript-estree'
import ts from 'typescript'

export const ROOT = path.resolve(import.meta.dirname, '../../..')

const SOURCE = /\.(ts|tsx)$/

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (SOURCE.test(entry.name)) out.push(full)
  }
  return out
}

// Every .ts/.tsx file under src/, as repo-relative paths, sorted.
export function sourceFiles() {
  return walk(path.join(ROOT, 'src'), [])
    .map(file => path.relative(ROOT, file))
    .sort()
}

export const isTest = file => /\.test\.tsx?$/.test(file) || file.includes('/__tests__/')

// The ratchet's unit: src/<top folder>, `src` for files at src/'s root, else the repo's top folder.
export function folderOf(file) {
  const parts = file.split('/')
  if (parts[0] !== 'src') return parts.length > 1 ? parts[0] : '(root)'
  return parts.length > 2 ? `src/${parts[1]}` : 'src'
}

export const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8')

export function parseFile(file) {
  return parse(read(file), {
    jsx: file.endsWith('.tsx'),
    loc: true,
    range: true,
    comment: true,
  })
}

const config = ts.getParsedCommandLineOfConfigFile(
  path.join(ROOT, 'tsconfig.json'),
  {},
  { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
)
const host = ts.createCompilerHost(config.options)

// The repo file an import specifier names, or undefined for a package or an unresolved name.
export function resolveImport(specifier, fromFile) {
  const { resolvedModule } = ts.resolveModuleName(
    specifier,
    path.join(ROOT, fromFile),
    config.options,
    host,
  )
  if (!resolvedModule || resolvedModule.isExternalLibraryImport) return undefined
  const file = path.relative(ROOT, resolvedModule.resolvedFileName)
  return file.startsWith('..') || file.includes('node_modules') ? undefined : file
}

// Visits every node of an ESTree program (parent first).
export function visit(node, enter, parent) {
  if (!node || typeof node.type !== 'string') return
  enter(node, parent)
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue
    const value = node[key]
    if (Array.isArray(value)) for (const child of value) visit(child, enter, node)
    else if (value && typeof value.type === 'string') visit(value, enter, node)
  }
}

export const count = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by)

export const table = (header, rows) =>
  [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
