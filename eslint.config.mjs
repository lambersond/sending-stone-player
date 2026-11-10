import pluginJs from '@eslint/js'
import pluginNext from '@next/eslint-plugin-next'
import stylistic from '@stylistic/eslint-plugin'
import { globalIgnores } from 'eslint/config'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import importX from 'eslint-plugin-import-x'
import nounsanitized from 'eslint-plugin-no-unsanitized'
import prettier from 'eslint-plugin-prettier'
import pluginReact from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import sonarjs from 'eslint-plugin-sonarjs'
import unicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// CLAUDE.md §2-3 as no-restricted-syntax selectors.
const ONE_EXPORT =
  'A .tsx file exports one thing, its React component (CLAUDE.md §2).'
const NO_HOOK =
  'A .tsx file exports no hook: it goes in its own use-*.ts (CLAUDE.md §2-3).'
const NO_UTILITY =
  'A .tsx file exports only a PascalCase component: utilities and constants go in a .ts (CLAUDE.md §2-3).'
const NO_TYPE_EXPORT = 'A .tsx file exports no type (CLAUDE.md §2).'
const TSX_TYPE =
  'Named types and interfaces go in a types.ts, not a .tsx (CLAUDE.md §3).'
const TS_TYPE_EXPORT = 'Exported named types go in a types.ts (CLAUDE.md §3).'

const NEXT_ROUTE_FILES = [
  '**/app/**/{page,layout,template,loading,error,global-error,not-found,global-not-found,forbidden,unauthorized,default,opengraph-image,twitter-image,icon,apple-icon}.tsx',
]
// What a Next.js route file may export besides its component (segment config and metadata):
const NEXT_ROUTE_EXPORTS = [
  'metadata',
  'generateMetadata',
  'viewport',
  'generateViewport',
  'generateStaticParams',
  'dynamic',
  'dynamicParams',
  'revalidate',
  'fetchCache',
  'runtime',
  'preferredRegion',
  'maxDuration',
  'instant',
  'prefetch',
  'alt',
  'size',
  'contentType',
  'generateImageMetadata',
].join('|')
const NEXT_ROUTE_EXPORT = `:matches([declaration.id.name=/^(?:${NEXT_ROUTE_EXPORTS})$/], [declaration.declarations.0.id.name=/^(?:${NEXT_ROUTE_EXPORTS})$/])`

const EXPORT =
  ':matches(ExportNamedDeclaration, ExportDefaultDeclaration, ExportAllDeclaration)'
const ROUTE_COUNTED_EXPORT = `:matches(ExportDefaultDeclaration, ExportAllDeclaration, ExportNamedDeclaration:not(${NEXT_ROUTE_EXPORT}))`
// The name an export gives: a function's, a class's, a const's, a specifier's or a default's.
const EXPORTED_NAME = `:matches(${[
  ':matches(ExportNamedDeclaration, ExportDefaultDeclaration) > :matches(FunctionDeclaration, ClassDeclaration) > Identifier.id',
  'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > Identifier.id',
  'ExportSpecifier > Identifier.exported',
  'ExportDefaultDeclaration > Identifier.declaration',
].join(', ')})`
const HOOK_NAME = '/^use[A-Z0-9]/'
// Neither a hook nor a PascalCase component (so MAX_ROLLS and formatRoll are utilities):
const utilityName = allowed =>
  `/^(?!(?:${allowed})$)(?!use[A-Z0-9])(?![A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$)/`

// Each .tsx's exports; and, but in a test, its named types (a test's file-private fixture types are
// not reusable, which is what CLAUDE.md §3 asks to go in a types.ts):
const tsxRules = (exported, allowed, { types = true } = {}) =>
  [
    'error',
    { selector: `Program > ${exported} ~ ${exported}`, message: ONE_EXPORT },
    {
      selector:
        "ExportNamedDeclaration[specifiers.length>1], ExportNamedDeclaration > VariableDeclaration[declarations.length>1], ExportAllDeclaration[exportKind='value']",
      message: ONE_EXPORT,
    },
    { selector: `${EXPORTED_NAME}[name=${HOOK_NAME}]`, message: NO_HOOK },
    {
      selector: `${EXPORTED_NAME}[name=${utilityName(allowed)}]`,
      message: NO_UTILITY,
    },
    {
      selector:
        "ExportNamedDeclaration[exportKind='type']:not([declaration]), ExportSpecifier[exportKind='type'], ExportAllDeclaration[exportKind='type']",
      message: NO_TYPE_EXPORT,
    },
    types && {
      selector: 'TSTypeAliasDeclaration, TSInterfaceDeclaration',
      message: TSX_TYPE,
    },
  ].filter(Boolean)

const asErrors = rules =>
  Object.fromEntries(Object.keys(rules).map(rule => [rule, 'error']))

// unicorn's prefer-native-coercion-functions, but for type guards. It takes a type guard such as
// `(note): note is NoteEntryView => Boolean(note)` for `Boolean`, and its autofix writes
// `.filter(Boolean)`, which narrows nothing, so tsc fails on what typechecked before the fix
// (unicorn 65 spares a type predicate only in an identity callback, `(x): x is T => x`). This copy
// reports all that unicorn's does but a function whose return type is a type predicate.
const nativeCoercion = unicorn.rules['prefer-native-coercion-functions']
const isTypeGuard = node =>
  node.returnType?.typeAnnotation.type === 'TSTypePredicate'
const nativeCoercionButTypeGuards = {
  meta: nativeCoercion.meta,
  create: context =>
    nativeCoercion.create(
      Object.create(context, {
        report: {
          value: problem => {
            if (!isTypeGuard(problem.node)) context.report(problem)
          },
        },
      }),
    ),
}

// The layers of src (CLAUDE.md §4, §5 and §7), each importing only from those beneath it. Features
// may import each other's public parts; what keeps them apart is that no module cycle forms.
// Two zones are named for the exceptions below.
const UTILS_FROM_LIB = {
  target: ['./src/utils', './src/schemas'],
  from: './src/lib',
}
const COMPONENTS_FROM_LIB = { target: './src/components', from: './src/lib' }
const LAYERS = [
  // The client trees never reach server-only code; pages, which are Server Components, may. Of
  // the utilities, those whose digests are node:crypto's, and what imports them, are server-only.
  {
    target: ['./src/features', './src/components', './src/hooks'],
    from: [
      './src/db',
      './src/lib/routes',
      './src/clients/prisma.ts',
      './src/auth.ts',
      './src/utils/gm-rolls.ts',
      './src/utils/notes/view.ts',
      './src/utils/notes/book.ts',
    ],
  },
  // Types and constants import only types and constants.
  { target: './src/types', from: './src', except: ['./types', './constants'] },
  {
    target: './src/constants',
    from: './src',
    except: ['./types', './constants'],
  },
  // Utilities and schemas import neither UI nor server code.
  {
    target: ['./src/utils', './src/schemas'],
    from: [
      './src/features',
      './src/components',
      './src/hooks',
      './src/app',
      './src/db',
    ],
  },
  UTILS_FROM_LIB,
  // App-wide hooks import no feature, page or server code, and of the shared components only the
  // modal's hooks, which a popover needs to open inside the modal it's in.
  {
    target: './src/hooks',
    from: ['./src/features', './src/app', './src/db', './src/lib'],
  },
  {
    target: './src/hooks',
    from: './src/components/**',
    except: ['**/src/components/modal/use-*.ts'],
  },
  // Shared components import no feature, page or server code.
  {
    target: './src/components',
    from: ['./src/features', './src/app', './src/db'],
  },
  COMPONENTS_FROM_LIB,
  // Features import no page; the database no route code; and the routes' helpers are the API's.
  { target: './src/features', from: './src/app' },
  { target: './src/db', from: ['./src/lib/routes', './src/app'] },
  {
    target: [
      './src/*',
      './src/!(app|lib)/**',
      './src/app/*',
      './src/app/!(api)/**',
      './src/lib/*',
      './src/lib/!(routes)/**',
    ],
    from: './src/lib/routes',
  },
]

// The layers, but for one exception in one zone (a path relative to its `from`), for named files.
const layersBut = (zone, except) => [
  'error',
  {
    basePath: import.meta.dirname,
    zones: LAYERS.map(each =>
      each === zone ? { ...each, except: [except] } : each,
    ),
  },
]

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
  // A directive that silences nothing is an error, so none outlives its finding (CLAUDE.md §9).
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    settings: {
      react: { version: 'detect' },
      // The import rules follow `@/` and TypeScript files (import/no-cycle needs both):
      'import-x/extensions': ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  unicorn.configs.recommended,
  nounsanitized.configs.recommended,
  // React's hook rules (the plugin's recommended set, the React Compiler's diagnostics included):
  {
    ...reactHooks.configs.flat.recommended,
    rules: asErrors(reactHooks.configs.flat.recommended.rules),
  },
  {
    plugins: {
      '@next/next': pluginNext,
      '@stylistic': stylistic,
      import: importX,
      prettier,
      sonarjs,
      app: {
        rules: {
          'prefer-native-coercion-functions': nativeCoercionButTypeGuards,
        },
      },
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // The names others give, which the app must spell their way: the Web App Manifest's,
      // next/font's and Prisma's compound keys.
      camelcase: [
        'error',
        {
          allow: [
            'short_name',
            'start_url',
            'background_color',
            'theme_color',
            'Geist_Mono',
            'bookId_noteId',
          ],
        },
      ],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/space-before-function-paren': [
        'error',
        { anonymous: 'always', named: 'never', asyncArrow: 'always' },
      ],
      '@stylistic/max-len': [
        'error',
        {
          code: 100,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': [
        'error',
        { max: 1, maxEOF: 0, maxBOF: 0 },
      ],
      '@stylistic/no-mixed-spaces-and-tabs': 'error',
      '@stylistic/no-multi-spaces': 'error',
      'no-alert': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-duplicate-imports': 'error',
      'react/display-name': 0,
      'react/no-unknown-property': 'off',
      'react/jsx-props-no-multi-spaces': 'error',
      'react/jsx-max-props-per-line': [1, { maximum: 1, when: 'multiline' }],
      'react/prop-types': 0,
      'react/react-in-jsx-scope': 'off',
      'unicorn/no-lonely-if': 'error',
      // An explicit `undefined` argument says "resolves to nothing", `.catch(undefined)` "left
      // out", and an arrow's `=> undefined` "returns nothing" (decisions Q2):
      'unicorn/no-useless-undefined': [
        'error',
        { checkArguments: false, checkArrowFunctionBody: false },
      ],
      // The protocol, Prisma and React use null for an absent value (decisions Q2):
      'unicorn/no-null': 'off',
      // unicorn 65 checks folder names too, and CLAUDE.md §8 puts integration tests in __tests__/,
      // whose snapshots Jest keeps in __snapshots__/:
      'unicorn/filename-case': [
        'error',
        { case: 'kebabCase', ignore: ['^__tests__$', '^__snapshots__$'] },
      ],
      'unicorn/prevent-abbreviations': 'off',
      // Its fix drops a type guard's narrowing: the copy above, which spares type guards, instead.
      'unicorn/prefer-native-coercion-functions': 'off',
      'app/prefer-native-coercion-functions': 'error',
      'import/no-unresolved': 'off',
      'import/no-duplicates': ['error', { considerQueryString: true }],
      'import/newline-after-import': 'error',
      'import/order': [
        'error',
        {
          pathGroups: [
            { pattern: 'react', group: 'external', position: 'before' },
            // Resolved, `@/` would rank as internal; it stays after relative imports, as before.
            { pattern: '@/**', group: 'unknown' },
          ],
          pathGroupsExcludedImportTypes: ['react', 'type'],
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'unknown',
            'type',
          ],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-restricted-paths': [
        'error',
        { basePath: import.meta.dirname, zones: LAYERS },
      ],
      // Type-only cycles, which this rule skips, fail src/__tests__/import-cycles.test.ts:
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': 'error',
      // No SonarQube in the repo: sonarjs's complexity limit stands in for it (CLAUDE.md §9).
      'sonarjs/cognitive-complexity': ['error', 15],
      'prettier/prettier': [
        'error',
        {
          arrowParens: 'avoid',
          bracketSpacing: true,
          endOfLine: 'auto',
          jsxSingleQuote: true,
          printWidth: 80,
          semi: false,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'all',
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    ignores: NEXT_ROUTE_FILES,
    rules: { 'no-restricted-syntax': tsxRules(EXPORT, 'default') },
  },
  {
    files: ['**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': tsxRules(EXPORT, 'default', { types: false }),
    },
  },
  {
    files: NEXT_ROUTE_FILES,
    rules: {
      'no-restricted-syntax': tsxRules(
        ROUTE_COUNTED_EXPORT,
        `default|${NEXT_ROUTE_EXPORTS}`,
      ),
    },
  },
  {
    files: ['**/*.ts'],
    // The homes of named types: a types.ts, the src/types/ folder (CLAUDE.md §4), declarations.
    ignores: ['**/types.ts', '**/types/**', '**/*.d.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ExportNamedDeclaration > :matches(TSTypeAliasDeclaration, TSInterfaceDeclaration), ExportNamedDeclaration[exportKind='type']:not([declaration]):not([source]), ExportNamedDeclaration:not([source]) > ExportSpecifier[exportKind='type']",
          message: TS_TYPE_EXPORT,
        },
      ],
    },
  },
  // A Server Component's one read of the session, its account menu's, which the header's test
  // mocks: these two files may import src/lib/session.ts.
  {
    files: [
      'src/components/site-header/header-account.tsx',
      'src/components/site-header/site-header.test.tsx',
    ],
    rules: {
      'import/no-restricted-paths': layersBut(
        COMPONENTS_FROM_LIB,
        './session.ts',
      ),
    },
  },
  // The note scanner's test checks it against showdown with the server's own options for Foundry.
  {
    files: ['src/utils/note-headings.test.ts'],
    rules: {
      'import/no-restricted-paths': layersBut(
        UTILS_FROM_LIB,
        './note-markdown.ts',
      ),
    },
  },
  // Suites whose helpers or harnesses React's hook rules misread: helpers named `use…` that are no
  // hooks (rules-of-hooks), and harness components that keep what they render in a variable
  // outside them for the test to read (refs, globals). Every other test keeps the rules.
  {
    files: [
      'src/features/sheet/components/use-picker/use-picker.test.tsx',
      'src/utils/requests/check-damage.test.ts',
      'src/utils/requests/checks.test.ts',
      'src/utils/sheet-actions.test.ts',
      'src/utils/uses.test.ts',
    ],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  {
    files: [
      'src/features/notes/components/chapter-form/chapter-form.test.tsx',
      'src/features/notes/components/note-editor/note-editor.test.tsx',
      'src/hooks/use-image-fallback.test.tsx',
    ],
    rules: { 'react-hooks/refs': 'off', 'react-hooks/globals': 'off' },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // The end-to-end suites and their scripts (e2e/README.md), written in another style:
    'e2e/**',
  ]),
].filter(Boolean)
