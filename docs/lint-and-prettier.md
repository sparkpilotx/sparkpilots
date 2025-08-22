### Linting & Formatting: ESLint 9 + Prettier 3 (TypeScript 5.8)

This project enforces strict, type-aware linting and consistent formatting across the Electron main, preload, and React renderer code.

#### Versions

- **TypeScript**: 5.8.3
- **ESLint**: ^9.33.0 (flat config)
- **@typescript-eslint**: ^8.39.1 (parser + plugin)
- **Prettier**: ^3.6.2

#### Config files

- `eslint.config.mjs` (flat):
  - Type-aware parsing with `project: ['./tsconfig.node.json', './tsconfig.web.json']`
  - Repo-wide ignores aligned with tsconfig and vendors:
    - `node_modules`, `dist`, `build`, `out`, `references/**`, `context-engineering/**`, `.cursor/**`, `.gemini/**`, `**/*.d.ts`
    - Also ignores shadcn/ui generated components: `src/renderer/src/components/ui/**`
  - Strict TypeScript rules (selected):
    - `@typescript-eslint/no-explicit-any`: error
    - Safety set: `no-unsafe-*` (assignment/argument/call/member-access/return)
    - `@typescript-eslint/explicit-function-return-type`: error (expressions allowed)
    - `@typescript-eslint/consistent-type-imports`: enforce type-only imports
    - `@typescript-eslint/no-misused-promises`: error with `checksVoidReturn: { attributes: false }`

- `.prettierrc.json`:
  - `semi: false`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`, `tabWidth: 2`, `useTabs: false`, `arrowParens: 'always'`

- `.prettierignore`:
  - Build outputs and non-source assets: `node_modules`, `out`, `dist`, `build`, images, `**/*.d.ts`
  - shadcn/ui components: `src/renderer/src/components/ui/**`

#### NPM scripts

- `npm run lint` → ESLint check with max-warnings=0
- `npm run lint:fix` → ESLint with `--fix`
- `npm run format` → Prettier write
- `npm run format:check` → Prettier check

#### Conventions and guidance

- Prefer fixing code over weakening rules. Examples:
  - Avoid `async` callbacks where a `void` return is expected (timers, event handlers). Use `void doAsync()` or `.catch(...)` instead.
  - Annotate component/function return types explicitly, e.g. `(): JSX.Element`.
  - Avoid `any` and, per project policy, avoid `unknown` where possible by modeling types precisely.
  - For intentionally unused variables or parameters, prefix with `_` to satisfy `@typescript-eslint/no-unused-vars` (configured with `argsIgnorePattern`/`varsIgnorePattern: '^_'`).

#### Scope

- Main, preload, and renderer are linted with type information via their respective `tsconfig.*.json` files.
- Vendor or generated code should be added to the ignore lists above to prevent false positives and churn.

#### Tips

- If adding a new TS project reference or directory, keep ESLint `project` array and ignore patterns in sync with `tsconfig.*.json`.
- Run `npm run typecheck` in CI alongside `lint` and `format:check` for consistent gating.
