## SVG-first asset pipeline

A reproducible, SVG-first workflow generates all tray and app icon rasters at build time. Only SVG sources are tracked in git; PNG/ICO/ICNS are generated.

### Inputs (tracked)

- `src/renderer/public/logo/tray.svg`: Monochrome, transparent tray glyph.
- `src/renderer/public/logo/app-icon.svg`: Full-color app icon source.

### Outputs (generated)

- Tray (macOS menu bar):
  - `trayTemplate.png` (16x16), `trayTemplate@2x.png` (32x32)
- App icons:
  - `256x256.png`, `512x512.png`, `1024x1024.png`
  - macOS: `icon-logo.icns` (via `iconutil` if available)
  - Windows: `icon-logo.ico` (via ImageMagick `magick convert` if available)

### Generator script

- `scripts/gen-tray-assets.mjs` (Node ESM)
- Depends on `sharp` (installed as devDependency)
- Optional external tools detected at runtime:
  - macOS: `iconutil` for `.icns`
  - Any OS: ImageMagick (`magick convert` or `convert`) for `.ico`

### NPM lifecycle

- `predev`: runs generator before `npm run dev`
- `prebuild`: runs generator before `npm run build`

Run manually:

```bash
node scripts/gen-tray-assets.mjs
```

### Main process integration

- Tray logic reads from `resources/logo` in production and `src/renderer/public/logo` in development.
- On macOS, if `trayTemplate.png` exists, it is used and marked as a template image so the system tints it automatically. The image is sized to 16 px for crisp rendering.
- Fallbacks exist for non-template assets and non-macOS platforms.

### Packaging

- `electron-builder.yml` copies `src/renderer/public/logo` to `resources/logo` via `extraResources`.
- macOS app icon path: `mac.icon: src/renderer/public/logo/icon-logo.icns`

### Git tracking

- `.gitignore` ignores generated rasters: `*.png`, `*.ico`, `*.icns`, and `app.iconset/` under `src/renderer/public/logo`.
- Only the two SVG sources are committed.

### Authoring guidelines

- Tray SVG: single color (black `#000`), transparent background, simple shapes for small sizes.
- App icon SVG: 1024×1024 viewBox recommended; keep important details readable at small sizes.
- Avoid embedded rasters inside SVG; prefer pure vector.

### Troubleshooting

- Black box in tray (macOS): ensure tray asset is transparent monochrome. The generator emits `trayTemplate.png` which the app tints; non-transparent art will look incorrect.
- Missing `.icns` or `.ico`: install `iconutil` (macOS) or ImageMagick (`magick`) or rely on PNGs which are already generated.
- Wrong icon in production: verify `extraResources` includes `logo/` and the files exist under `resources/logo` in the packaged app.

### Maintenance

- Replace `tray.svg` / `app-icon.svg` to update branding; assets regenerate automatically on the next dev/build.
- Adjust sizes or add formats by editing `scripts/gen-tray-assets.mjs`.
