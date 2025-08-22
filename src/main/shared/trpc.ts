// Ambient type re-export for AppRouter to be consumable from renderer without importing server code
// This import type is erased at compile time and only used for typing the client.
// Keep this in shared to satisfy both tsconfig.node and tsconfig.web projects.
//
// Usage examples:
// - From main process: import type { AppRouter } from '@shared/trpc';
// - From preload: import type { AppRouter } from '@shared/trpc';
// - From renderer: import type { AppRouter } from '@shared/trpc';
//
// Note: This file only exports types, not implementation, to avoid circular dependencies
// between main and renderer processes.

// Re-export the AppRouter type from the main process
// This import is safe because it's only used for type information
export type { AppRouter } from '../trpc/router'
