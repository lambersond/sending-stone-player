// Gate 11, directives (round.md §3.4, SA F7, §1.0 rule 9): every base module keeps its 'use client'
// or 'use server' and gains none (paths followed); a new module has 'use client' only if it is a
// component .tsx (not a types, constants, utils or use-* module), and none has 'use server'; the
// 'use server' modules stay 2; every module in the head's server graph (from src/app's pages,
// layouts, not-found, manifest, routes and actions through value imports, stopping at 'use client'
// modules) is a base server-graph module (followed) or a new module with no component; and
// header-account.tsx stays a Server Component.
import path from 'node:path'
import {
  directiveOf,
  gate,
  hasComponent,
  isTestFile,
  readBaseJson,
  serverGraph,
  verdict,
} from './gate-lib.mjs'

const HEADER = 'src/components/site-header/header-account.tsx'

gate('11', checkout => {
  const problems = []
  const notes = []
  const base = readBaseJson('base.json')
  const baseServer = new Set(base.server)
  const modules = checkout.files.filter(file => file.startsWith('src/') && /\.(ts|tsx)$/.test(file) && !isTestFile(file))
  let servers = 0
  for (const file of modules) {
    const directive = directiveOf(checkout.parse(file))
    if (directive === 'use server') servers += 1
    const was = checkout.base(file)
    if (was !== undefined) {
      const then = base.directives[was] ?? ''
      if (directive !== then) problems.push(`${file}: '${then || 'no directive'}' at the base (${was}), '${directive || 'no directive'}' now`)
      continue
    }
    if (directive === 'use server') problems.push(`${file}: a new 'use server' module`)
    if (directive === 'use client') {
      const name = path.basename(file)
      const piece = /^(types|constants|utils)\.tsx?$/.test(name) || /^use-/.test(name) || !file.endsWith('.tsx')
      if (piece || !hasComponent(file, checkout.parse(file))) problems.push(`${file}: a new 'use client' module that is not a component .tsx`)
      else notes.push(`new 'use client' component: ${file}`)
    }
  }
  if (servers !== 2) problems.push(`${servers} 'use server' modules, the base 2`)
  const graph = serverGraph(modules, file => checkout.parse(file), checkout.resolver.resolve)
  for (const file of graph.server) {
    const was = checkout.base(file)
    if (was !== undefined) {
      if (!baseServer.has(was)) problems.push(`${file}: in the server graph now, not at the base (${was})`)
    } else if (hasComponent(file, checkout.parse(file))) {
      problems.push(`${file}: a new component module in the server graph`)
    }
  }
  const header = checkout.head(HEADER)
  if (!header) problems.push(`${HEADER}: gone`)
  else if (!graph.server.includes(header)) problems.push(`${header}: not a Server Component in the server graph`)
  return verdict(
    problems,
    `${modules.length} modules, ${graph.server.length} server modules (base ${base.server.length}), ${graph.boundaries.length} client boundaries`,
    notes,
  )
})
