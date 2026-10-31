@AGENTS.md

# Engineering Guidelines

Follow these rules when creating, modifying, reviewing, or testing code in this repository. Prefer the simplest maintainable solution that satisfies the requirement. Preserve established project conventions unless they conflict with these rules.

## 1. Core principles

- **SOLID:** Keep responsibilities focused, dependencies explicit, interfaces small, and implementations replaceable where that flexibility is actually needed. Prefer composition over inheritance.
- **KISS:** Choose straightforward, readable solutions. Avoid unnecessary layers, abstractions, configuration, indirection, and speculative extensibility.
- **DRY, with judgment:** Extract genuinely shared behavior and UI patterns; do not create generic abstractions for one-off code or for implementations that only look similar.
- Favor small, cohesive components and functions with descriptive names and clear inputs/outputs.
- Avoid hidden side effects, deeply nested conditionals, magic values, and premature optimization.
- Make the smallest coherent change that addresses the task; do not refactor unrelated areas without a concrete need.

## 2. Components and TSX files

- **Each `.tsx` file may export at most one React component.** Do not export additional components, hooks, utilities, or types from it. A Next.js route file (`page.tsx`, `layout.tsx`, etc.) follows the same rule for TSX component exports; framework-required non-component exports (such as `metadata` or `generateMetadata`) are allowed.
- Prefer one primary responsibility per component: presentation and composition belong in components; domain calculations and transformations do not.
- Extract meaningful repeated UI into reusable, appropriately named components. Prefer controlled, composable APIs and typed props over duplicating similar markup.
- Keep component-specific implementation details local; promote a component to a common/shared location only when multiple consumers actually benefit.
- Avoid very large prop surfaces, excessive boolean flags, or highly configurable “universal” components. Split components when their responsibilities diverge.
- Keep JSX easy to scan; do not place complex conditionals, mapping rules, data transformations, or side-effectful operations directly in JSX.
- Use semantic HTML and accessible labels, roles, keyboard interactions, and focus management where relevant.

## 3. Types, constants, utilities, and hooks

- **Define named TypeScript types and interfaces in a `types.ts` file** at the narrowest appropriate shared scope. Import them with `import type` when possible. Do not declare reusable `type` or `interface` definitions in `.tsx` files.
- Keep constants in `constants.ts` (or a scoped `constants/` directory) when they are meaningfully shared or represent domain configuration. Avoid introducing files for trivial one-use values.
- **Place business rules and pure domain logic in utilities** (`utils.ts` or a scoped `utils/` directory), not in components. This includes calculations, transformations, validation, filtering, and other domain decisions.
- Prefer pure, deterministic utilities that are easy to test independently. Do not make a utility depend on React just to reuse it.
- **Use localized custom hooks** to extract nontrivial React state, effects, event coordination, and client-side workflow logic out of components. Hooks may call utilities, but should not duplicate business rules implemented by those utilities.
- Do not create a hook for logic that does not need React, or force server-side logic into a client hook.
- Keep each hook focused on a coherent behavior, and return a small, well-defined API.

## 4. Scope, colocation, and reuse

- **Colocate by default.** Put a component's private types, hooks, tests, constants, and utilities near that component or its feature.
- When two or more consumers need the same code, move it to their **lowest common ancestor in the source tree**—the closest shared scope that can serve all of them without cross-feature coupling.
- Hoist only as far as required. Do not put code into a global `src` directory merely because it might be reused someday.
- Use top-level `src/hooks/`, `src/utils/`, `src/types/`, and `src/constants/` for genuinely application-wide concerns, as needed.
- Prefer feature-owned code under `src/features/<feature>/` when multiple components and operations belong to one domain.
- Shared components should expose domain-neutral interfaces unless they are intentionally feature-specific.
- Avoid importing private internals of one feature from another. Extract shared functionality into an appropriate shared scope instead.

### Suggested structure (adapt to the existing project)

```text
src/
  app/                          # Next.js routes, layouts, API handlers
  components/                   # Shared UI components
    Button/
      Button.tsx
      Button.test.tsx           # Colocated unit/component test
      types.ts
  features/
    users/
      components/
        UserCard/
          UserCard.tsx
          UserCard.test.tsx
          types.ts
          utils.ts              # Only if local domain logic is needed
          useUserCard.ts        # Only if React behavior is needed
      hooks/                    # Hooks shared within this feature
      utils/                    # Business logic shared within this feature
      types.ts                  # Types shared within this feature
      constants.ts              # Constants shared within this feature
      __tests__/                # Feature integration tests
  hooks/                        # Application-wide hooks, when needed
  utils/                        # Application-wide utilities, when needed
  types/                        # Application-wide types, when needed
  constants/                    # Application-wide constants, when needed
  db/                           # Server-only database client/repositories
  __tests__/                    # Cross-feature integration tests
```

This is a placement guide, **not** a requirement to create empty directories or a file for every category. Follow the existing `src`/App Router conventions where applicable.

## 5. Next.js and server/client boundaries

- Prefer **Server Components by default** in the App Router. Add `'use client'` only where state, effects, event handlers, browser APIs, or client-only hooks require it.
- Keep client boundaries as narrow as practical to avoid shipping unnecessary JavaScript.
- Fetch data on the server when appropriate. Never import server-only code, database clients, or secrets into client modules.
- Use Server Actions/Server Functions or Route Handlers for appropriate server-side mutations and endpoints; perform authorization and input validation at the server boundary.
- Keep routing, request handling, and rendering thin. Delegate domain rules to utilities and persistence to server-only data-access modules.
- Be intentional about caching, freshness, revalidation, loading states, and error handling; follow the conventions of the Next.js version installed in this repository.
- Do not introduce a client-side data fetching layer when server-side data access already solves the problem simply.

## 6. Database efficiency and correctness

- Keep database access on the server and separate persistence concerns from domain rules; use a repository/data-access module when it improves clarity.
- Prevent **N+1 queries**; prefer joins, appropriate batching, or fetching related data together.
- Fetch only the columns and rows needed. Use filters, bounded pagination, and sensible limits for potentially large results.
- Ensure frequently queried filters, joins, and sort patterns have appropriate indexes, based on the actual query patterns.
- Run independent operations concurrently when safe, but do not increase database load without reason.
- Use transactions for multi-step changes that must succeed or fail atomically. Avoid unnecessary transactions and long-running locks.
- Reuse the project's configured database client/connection pool instead of establishing connections during rendering or on each operation.
- Parameterize queries and validate inputs. Do not construct SQL from untrusted strings.
- Measure or inspect query plans for suspected bottlenecks; optimize with evidence rather than guesswork.

## 7. Imports and dependency direction

- **Circular imports are not allowed**, including indirect import loops.
- Keep dependencies flowing from routes/UI toward feature logic, shared utilities, and server-side data access—not back upward into consumers.
- Do not import from another feature's private implementation to save a few lines. Move genuinely shared code to the nearest shared scope.
- Use `import type` for type-only dependencies where possible.
- Avoid barrel exports that hide dependency cycles, accidentally pull server code into client bundles, or make dependency direction unclear.
- Before introducing a shared module or refactoring imports, inspect its consumers and verify that it does not create a cycle.

## 8. Jest testing strategy

Use **Jest for focused unit and integration tests**. Test observable behavior rather than implementation details.

### Unit tests

- **Colocate unit tests with what they test**, e.g. `utils.test.ts` beside `utils.ts`, `useFeature.test.ts` beside its hook, or `Component.test.tsx` beside its component.
- Test nontrivial business rules, transformations, validation, state transitions, and component behavior at the smallest useful boundary.
- Cover the important happy path and meaningful edge/failure cases. Add cases because they expose distinct behavior or risk, **not** to inflate test counts.
- Use table-driven tests when several inputs demonstrate one rule more clearly than separate, repetitive tests.
- Avoid testing trivial pass-through code, framework internals, or implementation details that do not affect behavior.

### Integration tests

- **Place integration tests in a `__tests__/` directory under `src/`**, preferably within the owning feature (`src/features/<feature>/__tests__/`) or in `src/__tests__/` when crossing features.
- Exercise meaningful interactions between multiple units (for example, form → validation → mutation response → UI state) rather than duplicating every unit test.
- Mock external systems at deliberate boundaries, such as network services or the database, when appropriate. Keep the integrated application behavior real.
- Name integration tests clearly, e.g. `user-creation.integration.test.tsx`.

### Avoid overlapping coverage

- Do not repeat the same assertion in many layers. Unit tests should exhaustively cover complex utility branches; integration tests should confirm the wiring and a few key workflows.
- If a behavior is already well covered by a unit test, add an integration assertion only when it verifies an important cross-component or cross-layer contract.
- Favor a small, high-signal suite over numerous near-duplicate tests. Maintain reliability and readability, not arbitrary test volume.
- When fixing a bug, add or adjust the **smallest** regression test that would have caught it.

## 9. SonarQube and code quality

- Follow the repository's **SonarQube quality profile and quality gate** as well as its ESLint, TypeScript, and formatting rules.
- **Resolve all actionable SonarQube findings introduced by a change and any findings in code being modified.** Aim for zero unresolved findings rather than accepting warnings as normal.
- Pay particular attention to bugs, vulnerabilities, security hotspots, cognitive complexity, duplication, unused code, and reliability/maintainability issues.
- Review security hotspots and remediate genuine risks; do not treat a review marker as proof that code is safe.
- Do not silence issues using blanket exclusions, `eslint-disable`, `@ts-ignore`, `// NOSONAR`, or lowered thresholds merely to pass checks. Any unavoidable exception requires a narrowly scoped, documented justification.
- If a project-wide finding is outside the change's scope or cannot be resolved safely, clearly report it rather than claiming the scan is clean.

## 10. Working procedure and definition of done

Before changing code:
1. Inspect related code, existing patterns, the relevant types/utilities/hooks, and nearby tests.
2. Determine the narrowest appropriate ownership scope and check whether suitable reusable code already exists.
3. Plan dependency direction and server/client boundaries before creating new modules.

While implementing:
1. Make focused, readable changes using SOLID and KISS.
2. Extract pure business rules into scoped utilities and React behavior into scoped hooks when warranted.
3. Keep each `.tsx` file to one exported TSX component; place named types in `types.ts`.
4. Add or update targeted, nonredundant tests; check query efficiency and import cycles.

Before declaring completion:
1. Run the project's existing **typecheck, lint, relevant Jest tests, and build** commands when available and appropriate.
2. Run/inspect **SonarQube** checks when configured and accessible; resolve findings in scope.
3. Review for unnecessary abstraction, repeated logic, circular imports, accidental client-side server dependencies, inefficient database access, and redundant tests.
4. Report what changed, what was verified, and any checks that could not run. Never claim checks passed unless they actually ran.

**Decision rule:** When two approaches satisfy the requirements, choose the one with fewer moving parts that preserves clear boundaries and is easier to understand, reuse, and test.
