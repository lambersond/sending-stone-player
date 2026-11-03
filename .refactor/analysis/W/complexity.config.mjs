// Map W: only sonarjs/cognitive-complexity (limit 15), for a few files: not the repo's config.
// Usage: npx eslint -c .refactor/analysis/W/complexity.config.mjs --no-ignore -f json <files>
import tseslint from 'typescript-eslint'
import sonarjs from 'eslint-plugin-sonarjs'
export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { sonarjs },
    linterOptions: { reportUnusedDisableDirectives: 'off', noInlineConfig: true },
    rules: { 'sonarjs/cognitive-complexity': ['warn', 15] },
  },
]
