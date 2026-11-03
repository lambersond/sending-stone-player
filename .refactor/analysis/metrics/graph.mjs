// The import graph of src/: cycles (runtime and type-only) and barrel files with their importers.
import path from 'node:path'
import { parseFile, resolveImport, visit } from './lib.mjs'

const allTypeSpecifiers = specifiers =>
  specifiers.length > 0 &&
  specifiers.every(s => s.importKind === 'type' || s.exportKind === 'type')

// Each static import or re-export: { from, to, type, dynamic }.
function importsOf(file) {
  const edges = []
  const add = (source, type, dynamic = false) => {
    const to = typeof source === 'string' ? resolveImport(source, file) : undefined
    if (to) edges.push({ from: file, to, type, dynamic })
  }
  const program = parseFile(file)
  for (const statement of program.body) {
    if (statement.type === 'ImportDeclaration') {
      add(
        statement.source.value,
        statement.importKind === 'type' || allTypeSpecifiers(statement.specifiers),
      )
    } else if (
      (statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportAllDeclaration') &&
      statement.source
    ) {
      add(
        statement.source.value,
        statement.exportKind === 'type' || allTypeSpecifiers(statement.specifiers ?? []),
      )
    }
  }
  visit(program, node => {
    if (node.type === 'ImportExpression' && node.source.type === 'Literal') {
      add(node.source.value, false, true)
    }
  })
  return edges
}

export function importGraph(files) {
  const edges = files.flatMap(importsOf)
  // One edge per pair: runtime if any import between them is a runtime one.
  const pairs = new Map()
  for (const edge of edges) {
    const key = `${edge.from}\0${edge.to}`
    const known = pairs.get(key)
    if (!known) pairs.set(key, { ...edge })
    else {
      known.type &&= edge.type
      known.dynamic &&= edge.dynamic
    }
  }
  return { edges, pairs: [...pairs.values()] }
}

// Tarjan's strongly connected components of size > 1 (or with a self edge).
function components(nodes, next) {
  let index = 0
  const state = new Map()
  const stack = []
  const out = []
  const connect = node => {
    state.set(node, { index, low: index, onStack: true })
    index += 1
    stack.push(node)
    for (const to of next(node)) {
      if (!state.has(to)) {
        connect(to)
        state.get(node).low = Math.min(state.get(node).low, state.get(to).low)
      } else if (state.get(to).onStack) {
        state.get(node).low = Math.min(state.get(node).low, state.get(to).index)
      }
    }
    if (state.get(node).low === state.get(node).index) {
      const group = []
      let member
      do {
        member = stack.pop()
        state.get(member).onStack = false
        group.push(member)
      } while (member !== node)
      if (group.length > 1 || next(node).includes(node)) out.push(group.sort())
    }
  }
  for (const node of nodes) if (!state.has(node)) connect(node)
  return out
}

// Elementary cycles inside one component (Johnson-style search from each start), capped.
function elementaryCycles(group, next, cap = 50) {
  const members = new Set(group)
  const cycles = []
  group.forEach((start, startIndex) => {
    const allowed = new Set(group.slice(startIndex))
    const walk = (node, trail) => {
      if (cycles.length >= cap) return
      for (const to of next(node)) {
        if (!members.has(to) || !allowed.has(to)) continue
        if (to === start) cycles.push([...trail])
        else if (!trail.includes(to)) walk(to, [...trail, to])
      }
    }
    walk(start, [start])
  })
  return cycles
}

export function cycles({ pairs }) {
  const nodes = [...new Set(pairs.flatMap(p => [p.from, p.to]))].sort()
  const nextOf = keep => {
    const map = new Map()
    for (const pair of pairs.filter(keep)) {
      if (!map.has(pair.from)) map.set(pair.from, [])
      map.get(pair.from).push(pair.to)
    }
    return node => map.get(node) ?? []
  }
  const all = nextOf(() => true)
  const runtime = nextOf(pair => !pair.type)
  const runtimeGroups = components(nodes, runtime)
  return components(nodes, all).map(files => {
    const inside = new Set(files)
    const internal = pairs.filter(p => inside.has(p.from) && inside.has(p.to))
    return {
      files,
      runtimeGroups: runtimeGroups.filter(g => g.every(f => inside.has(f))),
      edges: internal,
      folders: [...new Set(files.map(f => path.dirname(f)))].sort(),
      cycles: elementaryCycles(files, all).map(cycle => ({
        files: cycle,
        type: cycle.some((from, i) => {
          const to = cycle[(i + 1) % cycle.length]
          return internal.find(p => p.from === from && p.to === to)?.type
        }),
      })),
    }
  })
}

// Every index.ts(x) under src/ with the number of files importing it.
export function barrels({ pairs }, files) {
  return files
    .filter(file => /(^|\/)index\.tsx?$/.test(file))
    .map(file => {
      const importers = pairs.filter(p => p.to === file).map(p => p.from)
      return { file, importers: importers.length, list: importers.sort() }
    })
    .sort((a, b) => b.importers - a.importers || a.file.localeCompare(b.file))
}
