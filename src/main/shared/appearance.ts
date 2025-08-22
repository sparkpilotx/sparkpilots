/**
 * Appearance/theming shared types
 *
 * These types are safe to import from both main and renderer. Do not import
 * Electron modules from this file to keep it platform-agnostic.
 */
import { z } from 'zod'

export const ThemeSourceSchema = z.union([
  z.literal('system'),
  z.literal('light'),
  z.literal('dark'),
])
export type ThemeSource = z.infer<typeof ThemeSourceSchema>

export const AppearanceSnapshotSchema = z.object({
  themeSource: ThemeSourceSchema,
  shouldUseDarkColors: z.boolean(),
})
export type AppearanceSnapshot = z.infer<typeof AppearanceSnapshotSchema>
