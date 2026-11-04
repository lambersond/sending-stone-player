// R1.9.28 / §1.7.4: each layered zone fires on a probe (eslint's lintText with a file path in the
// zone; nothing is written), and the allowed imports beside it don't.
import { createRequire } from 'node:module'
const root = process.argv[2]
const require = createRequire(root + '/package.json')
const { ESLint } = require('eslint')
const eslint = new ESLint({ cwd: root })
const probes = [
  // [zone, file, import, fires?]
  ['1 client trees', 'src/features/notes/probe.ts', '@/db/characters', true],
  ['1 client trees', 'src/components/probe.ts', '@/lib/routes/body', true],
  ['1 client trees', 'src/hooks/probe.ts', '@/clients/prisma', true],
  ['1 client trees', 'src/features/notes/probe.ts', '@/auth', true],
  ['1 client trees', 'src/features/notes/probe.ts', '@/clients/auth-client', false],
  ['2 types', 'src/types/probe.ts', '@/utils/dice', true],
  ['2 types', 'src/types/probe.ts', '@/schemas/notes', true],
  ['2 types', 'src/types/probe.ts', '@/constants/dice', false],
  ['2 types', 'src/types/probe.ts', '@/types/roll', false],
  ['3 constants', 'src/constants/probe.ts', '@/utils/dice', true],
  ['3 constants', 'src/constants/probe.ts', '@/hooks/use-stored', true],
  ['3 constants', 'src/constants/probe.ts', '@/types/roll', false],
  ['4 utils, schemas', 'src/utils/probe.ts', '@/features/rolling/constants', true],
  ['4 utils, schemas', 'src/utils/probe.ts', '@/components/modal/modal', true],
  ['4 utils, schemas', 'src/utils/probe.ts', '@/hooks/use-stored', true],
  ['4 utils, schemas', 'src/schemas/probe.ts', '@/db/characters', true],
  ['4 utils, schemas', 'src/schemas/probe.ts', '@/lib/app-origin', true],
  ['4 utils, schemas', 'src/utils/probe.ts', '@/schemas/notes', false],
  ['5 hooks', 'src/hooks/probe.ts', '@/features/rolling/constants', true],
  ['5 hooks', 'src/hooks/probe.ts', '@/lib/app-origin', true],
  ['5 hooks', 'src/hooks/probe.ts', '@/components/modal/modal', true],
  ['5 hooks', 'src/hooks/probe.ts', '@/components/modal/use-portal-root', false],
  ['6 components', 'src/components/probe.ts', '@/features/rolling/constants', true],
  ['6 components', 'src/components/probe.ts', '@/lib/session', true],
  ['6 components', 'src/components/site-header/header-account.tsx', '@/lib/session', false],
  ['6 components', 'src/components/probe.ts', '@/hooks/use-stored', false],
  ['7 features', 'src/features/notes/probe.ts', '@/app/characters/actions', true],
  ['7 db', 'src/db/probe.ts', '@/lib/routes/body', true],
  ['7 db', 'src/db/probe.ts', '@/app/characters/actions', true],
  ['7 lib/routes', 'src/lib/probe.ts', '@/lib/routes/body', true],
  ['7 lib/routes', 'src/app/characters/probe.ts', '@/lib/routes/body', true],
  ['7 lib/routes', 'src/probe.ts', '@/lib/routes/body', true],
  ['7 lib/routes', 'src/utils/probe.ts', '@/lib/routes/body', true],
  ['7 lib/routes', 'src/app/api/probe/route.ts', '@/lib/routes/body', false],
  ['7 lib/routes', 'src/lib/routes/probe.ts', '@/lib/routes/body', false],
]
let bad = 0
for (const [zone, file, spec, fires] of probes) {
  const [result] = await eslint.lintText(`import '${spec}'\n`, { filePath: `${root}/${file}` })
  const hit = result.messages.some(m => m.ruleId === 'import/no-restricted-paths')
  const ok = hit === fires
  if (!ok) bad += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'}\t${zone}\t${file} imports ${spec}\t${hit ? 'fires' : 'quiet'}`)
}
console.log(`${probes.length} probes, ${bad} wrong`)
process.exit(bad ? 1 : 0)
