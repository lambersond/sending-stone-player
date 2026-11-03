// Metrics read from the source: .tsx exports, named types, eslint-disable comments, file sizes.
import { count, isTest, parseFile, read, visit } from './lib.mjs'

// Kept in step with eslint.config.mjs's NEXT_ROUTE_FILES and NEXT_ROUTE_EXPORTS.
const ROUTE_FILE =
  /(^|\/)app\/(.*\/)?(page|layout|template|loading|error|global-error|not-found|global-not-found|forbidden|unauthorized|default|opengraph-image|twitter-image|icon|apple-icon)\.tsx$/
const ROUTE_EXPORT =
  /^(metadata|generateMetadata|viewport|generateViewport|generateStaticParams|dynamic|dynamicParams|revalidate|fetchCache|runtime|preferredRegion|maxDuration|instant|prefetch|alt|size|contentType|generateImageMetadata)$/

export const isRouteFile = file => ROUTE_FILE.test(file)

function kindOf(name, routeFile) {
  if (routeFile && ROUTE_EXPORT.test(name)) return 'framework'
  if (/^use[A-Z0-9]/.test(name)) return 'hook'
  if (/^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/.test(name)) return 'component'
  return 'utility'
}

const TYPE_DECLARATION = new Set(['TSTypeAliasDeclaration', 'TSInterfaceDeclaration'])

// One entry per exported name of a module: { name, kind }.
function exportsOf(program, routeFile) {
  const out = []
  const named = (name, typeOnly) =>
    out.push({ name, kind: typeOnly ? 'type' : kindOf(name, routeFile) })
  for (const statement of program.body) {
    if (statement.type === 'ExportAllDeclaration') {
      out.push({ name: `* from ${statement.source.value}`, kind: 'star' })
    } else if (statement.type === 'ExportDefaultDeclaration') {
      const { declaration } = statement
      const name = declaration.id?.name ?? declaration.name
      out.push(
        name
          ? { name: `default ${name}`, kind: kindOf(name, routeFile) }
          : { name: 'default (unnamed)', kind: 'default' },
      )
    } else if (statement.type === 'ExportNamedDeclaration') {
      const { declaration } = statement
      if (!declaration) {
        const typeOnly = statement.exportKind === 'type'
        for (const specifier of statement.specifiers) {
          const name = specifier.exported.name ?? specifier.exported.value
          if (name === 'default') out.push({ name: 'default (specifier)', kind: 'default' })
          else named(name, typeOnly || specifier.exportKind === 'type')
        }
      } else if (declaration.type === 'VariableDeclaration') {
        for (const declarator of declaration.declarations) {
          named(declarator.id.name ?? '{pattern}', false)
        }
      } else if (TYPE_DECLARATION.has(declaration.type)) {
        named(declaration.id.name, true)
      } else if (declaration.type === 'TSEnumDeclaration') {
        out.push({ name: declaration.id.name, kind: 'enum' })
      } else {
        named(declaration.id?.name ?? '(unnamed)', false)
      }
    }
  }
  return out
}

const NOT_COMPONENT = new Set(['hook', 'utility', 'type', 'star', 'enum'])

// .tsx files that export more than one thing (framework names aside) or a non-component.
export function tsxExports(files) {
  const breaking = []
  for (const file of files.filter(f => f.endsWith('.tsx'))) {
    const exported = exportsOf(parseFile(file), isRouteFile(file))
    const counted = exported.filter(e => e.kind !== 'framework')
    if (counted.length > 1 || counted.some(e => NOT_COMPONENT.has(e.kind))) {
      breaking.push({ file, exported })
    }
  }
  return breaking
}

const isTypesHome = file =>
  /(^|\/)types\.ts$/.test(file) || /(^|\/)types\//.test(file) || file.endsWith('.d.ts')

// Named types declared in .tsx files, and exported named types in .ts files outside types.ts.
export function namedTypes(files) {
  const inTsx = new Map()
  const exportedTs = new Map()
  for (const file of files) {
    const program = parseFile(file)
    if (file.endsWith('.tsx')) {
      visit(program, node => TYPE_DECLARATION.has(node.type) && count(inTsx, file))
    } else if (!file.endsWith('.d.ts') && !/(^|\/)types\.ts$/.test(file)) {
      for (const statement of program.body) {
        if (statement.type !== 'ExportNamedDeclaration' || statement.source) continue
        if (TYPE_DECLARATION.has(statement.declaration?.type)) count(exportedTs, file)
        const typeSpecifiers = statement.declaration
          ? 0
          : statement.specifiers.filter(
              s => statement.exportKind === 'type' || s.exportKind === 'type',
            ).length
        if (typeSpecifiers > 0) count(exportedTs, file, typeSpecifiers)
      }
    }
  }
  return { inTsx, exportedTs, isTypesHome }
}

const DIRECTIVE = /^\s*(eslint-disable(?:-next-line|-line)?|eslint-enable)(?:\s+([\s\S]*))?$/

function parseDirective(comment) {
  const match = DIRECTIVE.exec(comment.value)
  if (!match) return undefined
  // ESLint's own split between the rules and the description:
  const [rulesText, ...reasonParts] = ` ${match[2] ?? ''} `.split(/\s-{2,}\s/u)
  const rules = rulesText
    .split(',')
    .map(rule => rule.trim())
    .filter(Boolean)
  return {
    directive: match[1],
    rules: rules.length > 0 ? rules : ['(all rules)'],
    reason: reasonParts.join(' -- ').trim(),
    line: comment.loc.start.line,
    block: comment.type === 'Block',
  }
}

// Every eslint-disable comment: rule, scope (line, range, file), and whether it gives a reason.
export function disables(files) {
  const rows = []
  for (const file of files) {
    const { comments } = parseFile(file)
    const directives = comments.map(parseDirective).filter(Boolean)
    const commentLines = new Set(comments.flatMap(c => [c.loc.start.line, c.loc.end.line]))
    for (const d of directives) {
      if (d.directive === 'eslint-enable') continue
      for (const rule of d.rules) {
        let scope = 'line'
        if (d.directive === 'eslint-disable') {
          const enabled = directives.some(
            e =>
              e.directive === 'eslint-enable' &&
              e.line > d.line &&
              (e.rules.includes(rule) || e.rules[0] === '(all rules)'),
          )
          scope = d.block ? (enabled ? 'range' : 'file') : 'not applied (line comment)'
        }
        let reason = 'none'
        if (d.reason) reason = '-- reason'
        else if (commentLines.has(d.line - 1)) reason = 'comment above'
        rows.push({ file, line: d.line, rule, scope, reason, test: isTest(file) })
      }
    }
  }
  return rows
}

export function sizes(files, over) {
  return files
    .map(file => ({ file, lines: read(file).split('\n').length - 1, test: isTest(file) }))
    .filter(({ lines }) => lines > over)
    .sort((a, b) => b.lines - a.lines)
}
