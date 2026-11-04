/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// No module of src imports itself back, through any chain of imports, type-only ones included
// (CLAUDE.md §7). The linter's import/no-cycle skips `import type`, so this holds the rest.

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

/** Every TypeScript module under src/, but declaration files. */
function modulesIn(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(folder, entry.name)
    if (entry.isDirectory()) return modulesIn(file)
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')
      ? [file]
      : []
  })
}

/** What a module imports, by path: static and dynamic imports, re-exports, `import('…')` types. */
function importsOf(file: string, options: ts.CompilerOptions): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const specifiers: string[] = []
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text)
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return specifiers.flatMap(specifier => {
    const { resolvedModule } = ts.resolveModuleName(
      specifier,
      file,
      options,
      ts.sys,
    )
    const resolved = resolvedModule?.resolvedFileName
    return resolved?.startsWith(SRC) && !resolved.endsWith('.d.ts')
      ? [resolved]
      : []
  })
}

/** The graph's strongly connected groups of more than one module, or of one importing itself. */
function cyclesOf(graph: ReadonlyMap<string, string[]>): string[][] {
  let next = 0
  const order = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const groups: string[][] = []
  const connect = (node: string) => {
    order.set(node, next)
    low.set(node, next)
    next += 1
    stack.push(node)
    onStack.add(node)
    for (const to of graph.get(node) ?? []) {
      if (!order.has(to)) {
        connect(to)
        low.set(node, Math.min(low.get(node)!, low.get(to)!))
      } else if (onStack.has(to)) {
        low.set(node, Math.min(low.get(node)!, order.get(to)!))
      }
    }
    if (low.get(node) !== order.get(node)) return
    const group: string[] = []
    let member: string | undefined
    do {
      member = stack.pop()!
      onStack.delete(member)
      group.push(path.relative(ROOT, member))
    } while (member !== node)
    if (group.length > 1 || graph.get(node)?.includes(node)) {
      groups.push(group.toSorted())
    }
  }
  for (const node of graph.keys()) if (!order.has(node)) connect(node)
  return groups
}

describe('src’s import graph', () => {
  it('has no cycle, type-only imports included', () => {
    const config = ts.readConfigFile(
      path.join(ROOT, 'tsconfig.json'),
      ts.sys.readFile,
    )
    const { options } = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      ROOT,
    )
    const graph = new Map(
      modulesIn(SRC).map(file => [file, importsOf(file, options)] as const),
    )
    expect(cyclesOf(graph)).toEqual([])
  })
})
