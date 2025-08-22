## Appearance and Theming

This document explains how SparkPilot follows the operating system appearance (light/dark) across all windows. The current scope intentionally excludes user overrides and persistence; the app always mirrors the OS theme.

### Objectives and constraints

- **System-following only**: No user preference stored; theme always reflects OS.
- **No flicker**: First paint matches OS mode; no white/black flash on startup or OS theme change.
- **Minimal, secure surface**: Preload exposes a tiny, validated API; renderer never imports Node/Electron directly.
- **Multi-window consistency**: All windows update live and consistently.
- **Stack alignment**: Electron v37, `BaseWindow` + `WebContentsView`, strict security defaults.

### High-level flow

1. Main sets `nativeTheme.themeSource = 'system'` and listens for `nativeTheme.updated`.
2. Main broadcasts `appearance:updated` with a schema-validated snapshot to all renderer processes.
3. Preload exposes `window.xAPI.appearance` with `get()` and `onUpdated()` and validates payloads with Zod.
4. Renderer toggles the root `.dark` class based on the snapshot and subscribes for live updates.
5. First-paint is stabilized by a dark/light background hint in `index.html`, an early `.dark` toggle in preload, and `BaseWindow` background + delayed `show`.

### Files and responsibilities

- `src/main/appearance.ts`
  - Sets `nativeTheme.themeSource = 'system'`.
  - Handles `nativeTheme.updated` and broadcasts to all `webContents` via `appearance:updated`.
  - Implements `appearance:get` (IPC invoke) to provide initial snapshot.

- `src/main/shared/appearance.ts`
  - Zod schemas: `ThemeSourceSchema`, `AppearanceSnapshotSchema`.
  - Exported types inferred from schemas (`ThemeSource`, `AppearanceSnapshot`).

- `src/preload/index.ts`
  - Exposes `window.xAPI.appearance.get()` and `window.xAPI.appearance.onUpdated(cb)` using `electronAPI.ipcRenderer`.
  - Validates all IPC payloads with Zod; ignores malformed data.
  - Applies an early `.dark` class via `matchMedia('(prefers-color-scheme: dark)')` to avoid initial flash.

- `src/main/windows/window-factory.ts`
  - Uses `BaseWindow` with `show: false` and a `backgroundColor` derived from `nativeTheme.shouldUseDarkColors`.
  - Shows the window on `did-finish-load` (keeps DevTools on `dom-ready`) to avoid intermediate paints.

- `src/renderer/index.html`
  - `<meta name="color-scheme" content="light dark">` to hint the UA.
  - Inline CSS to color the `html` background via `prefers-color-scheme` for the very first paint.

- `src/renderer/index.tsx`
  - Calls `appearance.get()` at startup and applies `.dark` accordingly.
  - Subscribes to `appearance.onUpdated` to keep the UI in sync.

- `src/renderer/src/styles/globals.css`
  - Theme tokens are CSS variables.
  - `.dark` class switches variables for dark mode; no extra media-query duplication.

### IPC contract

- Channels
  - `appearance:get` (invoke)
  - `appearance:updated` (event)

- Payload shape

```json
{
  "themeSource": "system" | "light" | "dark",
  "shouldUseDarkColors": true | false
}
```

- Validation
  - Renderer-side validation via `AppearanceSnapshotSchema.parse()` for `get()` and `safeParse()` for `updated`.

### No-flicker strategy (first-paint stability)

- **Main**: `BaseWindow` created with `show: false` and a theme-appropriate `backgroundColor`.
- **HTML**: Inline `html` background via `prefers-color-scheme` ensures the initial paint matches OS mode.
- **Preload**: Early `.dark` toggle via `matchMedia` before the main bundle runs.
- **Renderer**: Confirms via `appearance.get()` and maintains via `appearance:updated`.
- **Show timing**: `window.show()` on `did-finish-load` (not `dom-ready`).

### Security and validation

- **Process isolation**: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
- **Strict boundary**: Renderer code never imports Node/Electron APIs; all OS interactions live behind preload.
- **Zod validation**: All IPC payloads are validated at the preload boundary; malformed messages are ignored.
- **CSP**: `index.html` includes inline CSS for first-paint; current CSP allows `'unsafe-inline'` for styles. If you tighten CSP, move the inline CSS into a static stylesheet or use a nonce/hash.

### Testing and QA checklist

- Toggle OS light/dark with windows:
  - Closed → then opened
  - Visible and active
  - Minimized → restored
  - Multiple windows open
- Confirm:
  - No flash on startup or theme change
  - `.dark` class toggles on the root element
  - All three windows render consistent tokens in both modes
  - DevTools opens on `dom-ready` without introducing flicker

### Troubleshooting tips

- Seeing a flash?
  - Ensure `BaseWindow` has `show: false` and `backgroundColor` set from `nativeTheme.shouldUseDarkColors`.
  - Verify `window.show()` runs on `did-finish-load` only.
  - Keep the inline `html` background in `index.html` and early `.dark` toggle in preload.

### Out of scope / future work

- User theme overrides and persistence are intentionally excluded.
- If needed later:
  - Add `appearance.setThemeSource('system'|'light'|'dark')` IPC in main (Zod-validated).
  - Persist preference under `userData` and respect it on startup, listening to OS changes only when `themeSource === 'system'`.
