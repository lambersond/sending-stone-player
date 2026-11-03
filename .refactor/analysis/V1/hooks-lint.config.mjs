// V1's probe: react-hooks 7.1.1's recommended rules (Q3) over the table's files only, to list what
// they would flag. Run: npx eslint --no-config-lookup -c .refactor/analysis/V1/hooks-lint.config.mjs <files>
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs['recommended-latest'].rules },
  },
]
