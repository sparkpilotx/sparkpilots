### Appearance & Theming

This document describes how SparkPilot handles OS appearance (light/dark), how the theme is propagated across processes, and how to integrate UI controls to switch themes.

#### Goals

- Respect OS theme out of the box; avoid flash of unstyled content (FOUC).
- Minimal, Zod-validated preload surface; strict Electron security defaults.
- Single source of truth for runtime contracts via `@shared`.

### Architecture

- **Main**: Observes OS theme via `nativeTheme` and exposes a tRPC router `appearance`:
  - `getSnapshot` (query), `setThemeSource` (mutation), `onChanged` (subscription via SSE).
  - On startup, restores the persisted `themeSource` from the preferences DB before any windows show.
- **Preload**: Performs a minimal early paint: toggles `.dark` and sets `color-scheme` using `matchMedia('(prefers-color-scheme: dark)')` to minimize FOUC. No appearance APIs are exposed.
- **Renderer**: `AppearanceProvider` calls tRPC to load/persist theme and subscribes to `appearance.onChanged`. It toggles the `.dark` class on `html` and updates `color-scheme` on the root element. On mount, it applies an optimistic theme (based on persisted `themeSource` or `prefers-color-scheme`) via `useLayoutEffect` to minimize flash. User changes are applied optimistically before server confirmation.
- **Shared**: Contracts (types and Zod schemas) live in `@shared/appearance`.

### Files

- `src/main/shared/appearance.ts` (alias: `@shared/appearance`)
- `src/main/trpc/routers/appearance/index.ts` (tRPC appearance router)
- `src/main/trpc/routers/preferences/index.ts` (DB persistence of `themeSource`)
- `src/preload/index.ts` (no appearance logic)
- (renderer provider and settings window have been removed in current iteration)
- `src/main/window-manager.ts` (FOUC mitigation via `backgroundColor`)
- `src/main/index.ts` (restores persisted `nativeTheme.themeSource` on startup)

### Shared contracts (`@shared/appearance`)

```ts
export type ThemeSource = 'system' | 'light' | 'dark'
export const ThemeSourceSchema = z.enum(['system', 'light', 'dark'])

export const AppearanceSnapshotSchema = z.object({
  isDarkMode: z.boolean(),
  themeSource: ThemeSourceSchema,
})
export type AppearanceSnapshot = z.infer<typeof AppearanceSnapshotSchema>
```

### tRPC API (main → renderer)

- `appearance.getSnapshot` (query) → `AppearanceSnapshot`
- `appearance.setThemeSource({ themeSource })` (mutation) → `AppearanceSnapshot`
- `appearance.onChanged` (subscription) → streams `AppearanceSnapshot`
- `preferences.getThemeSource`/`setThemeSource` for DB persistence

Example usage in renderer:

```ts
import { trpcProxy, trpcClient } from '@/lib/trpc'

const snapshot = await trpcProxy.appearance.getSnapshot.query()
await trpcProxy.appearance.setThemeSource.mutate({ themeSource: 'dark' })
const sub = trpcClient.appearance.onChanged.subscribe(undefined, {
  onData: (next) => console.log(next),
})
sub.unsubscribe()
```

### Renderer provider and hooks

- `AppearanceProvider` synchronizes theme on mount and on OS/user changes.
- `useAppearance(): { isDarkMode, themeSource, setThemeSource }`
- `useIsDarkMode(): boolean`

Example:

```tsx
const { isDarkMode, themeSource, setThemeSource } = useAppearance()
```

### Settings UI (example)

The Settings window provides a minimal dropdown to switch between `system`, `light`, and `dark`:

```tsx
<Select value={themeSource} onValueChange={(value: ThemeSource) => setThemeSource(value)}>
  <SelectTrigger id="theme-source">
    <SelectValue placeholder="Select theme" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="system">System</SelectItem>
    <SelectItem value="light">Light</SelectItem>
    <SelectItem value="dark">Dark</SelectItem>
  </SelectContent>
</Select>
```

### FOUC mitigations

- **Preload early paint**: Preload sets `.dark` and `color-scheme` based on `prefers-color-scheme` before React mounts.
- **Renderer early apply**: On mount, `AppearanceProvider` re-applies the theme via `useLayoutEffect`, synchronized with main snapshot/subscription.
- **Window background**: Each `BrowserWindow` sets `backgroundColor` according to `nativeTheme.shouldUseDarkColors` for a seamless pre-DOM paint.
- **CSP/CORS**: No inline scripts; `script-src 'self'`. `connect-src` allows HTTP/S (and WebSocket for dev HMR). The tRPC server allows `*` in dev and restricts origins in production (including `file://` via null origin) while supporting SSE.

### Security & constraints

- Windows use `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
- Preload surface is minimal; renderer does not import Node/Electron APIs.
- tRPC is the sole transport for app/domain data including appearance.
- Contracts are centralized in `@shared` and imported by all layers.

### Styling

- Tailwind v4 with semantic tokens in `globals.css`. The provider toggles the `.dark` class; no direct token edits are required for theme switching.

### Troubleshooting

- **Flash persists in dev**: HMR can still cause minor flashes. Verify behavior in production build or disable HMR to compare.
- **Theme not changing**: Ensure the Settings UI calls `setThemeSource` and that subscribers receive updates from `appearance.onChanged` (SSE). Check the console for Zod validation errors.
- **Multiple windows**: Changes are broadcast to all open windows via the main process.

### Extensibility

- Preference persistence: done via `preferences` router; main restores `nativeTheme.themeSource` at startup.
- Add a quick toggle in window chrome that calls `appearance.setThemeSource`.
