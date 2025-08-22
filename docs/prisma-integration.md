## Prisma + PostgreSQL Integration

This app uses Prisma ORM with a local PostgreSQL 17 instance as the persistence layer. Prisma runs in the Electron main process and is exposed to the renderer via tRPC.

### Requirements

- Node.js v24 (recommended by project)
- PostgreSQL 17 running locally
- `.env.local` with the connection string:

```
MAIN_VITE_POSTGRES_URL=postgres://postgres:postgres@localhost:5432/sparkpilot
```

The main process reads the URL via `import.meta.env.MAIN_VITE_POSTGRES_URL`.

### Install

- Installed packages (already added):
  - Runtime: `@prisma/client`
  - Dev: `prisma`, `dotenv-cli`

### Schema

- Prisma schema lives at `prisma/schema.prisma`.
- Default model included:
  - `Idea { id, title, content?, createdAt, updatedAt }`
- Edit the schema as needed, then run migrations.

### NPM scripts

Use these commands (they load `.env.local` via `dotenv-cli`):

```
npm run db:generate  # Generate Prisma Client
npm run db:migrate   # Create/apply dev migration (name: init)
npm run db:reset     # Drop & recreate dev DB, re-apply migrations
npm run db:studio    # Open Prisma Studio
```

### Runtime integration

- Prisma client singleton: `src/main/prisma.ts`
  - Uses `import.meta.env.MAIN_VITE_POSTGRES_URL` via Prisma `datasources` override
  - Reuses a single instance during dev hot reload
- tRPC context: `src/main/trpc/context.ts`
  - Exposes `ctx.prisma` to all procedures
- Health check: `src/main/trpc/routers/health.ts`
  - `health.db` executes a lightweight `SELECT 1`
- Sample CRUD: `src/main/trpc/routers/ideas.ts`
  - `list`, `create`, `delete` against the `Idea` model

### Renderer usage

- Call the health endpoint to verify DB is reachable:

```ts
const { data, error } = useQuery(trpc.health.db.queryOptions())
```

- Access CRUD endpoints similarly (e.g., `trpc.ideas.list`, `trpc.ideas.create`).

### Packaging (production)

Electron needs Prisma engines bundled/unpacked:

- `electron-builder.yml` includes:
  - `asarUnpack: node_modules/@prisma/engines/**`
  - `extraResources: node_modules/@prisma/engines → @prisma/engines`

This ensures the Node-API query engine can be loaded at runtime.

### Development workflow

1. Start Postgres 17 locally and ensure the DB exists (`sparkpilot`).
2. Keep `.env.local` set with `MAIN_VITE_POSTGRES_URL`.
3. Update `prisma/schema.prisma` as needed.
4. Run:

```
npm run db:migrate
npm run start
```

### Troubleshooting

- Connection fails
  - Verify Postgres is running and reachable at `localhost:5432`.
  - Confirm `.env.local` is present at project root and contains `MAIN_VITE_POSTGRES_URL`.
- Migration drift
  - Use `npm run db:reset` to reset dev DB, then re-run `db:migrate`.
- Production missing engine
  - Ensure the builder config matches the repo (see Packaging section).
- Apple Silicon
  - Use native Postgres builds for arm64; Prisma auto-downloads correct engines.

### Notes

- The Prisma client is only used in the Electron main process; the renderer calls tRPC procedures.
- The server URL for tRPC is configured by `VITE_TRPC_HTTP_URL` in `.env.local`.
