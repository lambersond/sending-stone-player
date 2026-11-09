import nextJest from 'next/jest.js'
import type { Config } from 'jest'

// Every suite runs in UTC, whatever the machine's own zone: set here, in Jest's own process before
// its workers start, as each worker and a run in band take it from there (a suite's own
// `process.env.TZ` is a copy, which Node's clock never reads).
process.env.TZ = 'UTC'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  // Each is a regular expression found anywhere in a file's path, so a folder is anchored to the
  // slashes around it, and a file's name to its folder and its end, its dot escaped: a bare
  // `index.ts` also left out `campaign-index.tsx`.
  coveragePathIgnorePatterns: [
    '/src/app/api/auth/',
    '/src/clients/',
    String.raw`/auth-providers\.ts$`,
    String.raw`/auth\.ts$`,
    String.raw`/index\.ts$`,
    '/mocks/',
    String.raw`/types\.ts$`,
    '/types/',
    String.raw`/utils/test-utils-node\.ts$`,
    String.raw`/utils/test-utils\.ts$`,
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover', 'json-summary', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  clearMocks: true,
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  modulePaths: ['<rootDir>/src'],
  moduleNameMapper: {
    // The dice packages export only for `import`, which Jest's require doesn't match.
    '^@lambersond/3d-dice-(core|engine|react)$':
      '<rootDir>/node_modules/@lambersond/3d-dice-$1/dist/index.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
