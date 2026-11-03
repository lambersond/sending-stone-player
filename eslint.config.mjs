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

// CLAUDE.md §2-3 as no-restricted-syntax selectors, warnings until the refactor's last lint commit.
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

const tsxRules = (exported, allowed) => [
  'warn',
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
  {
    selector: 'TSTypeAliasDeclaration, TSInterfaceDeclaration',
    message: TSX_TYPE,
  },
]

const asWarnings = rules =>
  Object.fromEntries(Object.keys(rules).map(rule => [rule, 'warn']))

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
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
  // React's hook rules (the plugin's recommended set), as warnings for now:
  {
    ...reactHooks.configs.flat.recommended,
    rules: asWarnings(reactHooks.configs.flat.recommended.rules),
  },
  {
    plugins: {
      '@next/next': pluginNext,
      '@stylistic': stylistic,
      import: importX,
      prettier,
      sonarjs,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      camelcase: 'error',
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
      // unicorn 65 checks folder names too, and CLAUDE.md §8 puts integration tests in __tests__/:
      'unicorn/filename-case': [
        'error',
        { case: 'kebabCase', ignore: ['^__tests__$'] },
      ],
      'unicorn/prevent-abbreviations': 'off',
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
        'warn',
        {
          zones: [
            {
              target: './src/types/**/*',
              from: './src/@(components|app|utils|constants|hooks|db|schemas)/**/*',
            },
            {
              target: './src/constants/**/*',
              from: './src/@(components|app|utils|hooks|db|schemas)/**/*',
            },
            {
              target: './src/utils/**/*',
              from: './src/@(components|app|hooks|schemas|db)/**/*',
            },
            {
              target: './src/db/**/*',
              from: './src/@(components|app|hooks|schemas)/**/*',
            },
            {
              target: './src/schemas/**/*',
              from: './src/@(components|app|hooks)/**/*',
            },
            {
              target: './src/hooks/**/*',
              from: './src/@(components|app)/**/*',
            },
            { target: './src/components/**/*', from: './src/@(app)/**/*' },
          ],
        },
      ],
      'import/no-cycle': 'warn',
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': 'error',
      // No SonarQube in the repo: sonarjs's complexity limit stands in for it (CLAUDE.md §9).
      'sonarjs/cognitive-complexity': ['warn', 15],
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
        'warn',
        {
          selector:
            "ExportNamedDeclaration > :matches(TSTypeAliasDeclaration, TSInterfaceDeclaration), ExportNamedDeclaration[exportKind='type']:not([declaration]):not([source]), ExportNamedDeclaration:not([source]) > ExportSpecifier[exportKind='type']",
          message: TS_TYPE_EXPORT,
        },
      ],
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // The end-to-end suites and their scripts (e2e/README.md), written in another style:
    'e2e/**',
    // The v0.43 refactor's temporary planning folder (deleted in the PR's last commit):
    '.refactor/**',
  ]),
].filter(Boolean)
