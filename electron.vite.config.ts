import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Electron-Vite configuration for SparkPilot desktop application.
 *
 * This configuration defines build settings for the three main processes:
 * - main: Main Electron process (Node.js environment)
 * - preload: Preload scripts (Node.js environment with limited APIs)
 * - renderer: Renderer process (browser environment with React)
 *
 * @remarks
 * The configuration follows Electron's security model by externalizing Node.js
 * dependencies in main/preload processes and isolating renderer process.
 *
 * @see {@link https://electron-vite.org/guide/} Electron-Vite documentation
 */
export default defineConfig({
  /**
   * Main process configuration (Node.js environment)
   * Handles app lifecycle, window management, and system integration
   */
  main: {
    resolve: {
      alias: {
        // Shared utilities accessible to main and preload processes
        '@shared': resolve('src/main/shared'),
      },
    },
    plugins: [
      // Externalizes Node.js dependencies to avoid bundling issues
      externalizeDepsPlugin(),
    ],
  },

  /**
   * Preload process configuration (Node.js environment with limited APIs)
   * Provides secure bridge between main and renderer processes
   */
  preload: {
    resolve: {
      alias: {
        // Shared utilities accessible to main and preload processes
        '@shared': resolve('src/main/shared'),
      },
    },
    plugins: [
      // externalizeDepsPlugin() is removed to bundle deps for sandbox
    ],
    build: {
      rollupOptions: {
        output: {
          // Preload scripts for sandboxed renderers must not contain ES module syntax.
          // Use 'cjs' so preload works with sandbox: true.
          format: 'cjs',
        },
      },
    },
  },

  /**
   * Renderer process configuration (browser environment)
   * Handles UI rendering with React and TailwindCSS
   */
  renderer: {
    // Development server configuration
    server: {
      host: 'localhost', // Restrict to localhost only for security
      proxy: {
        // TODO(proxy): Add API proxy configuration for development | tracking: TBD
      },
    },

    // Production build configuration
    build: {
      rollupOptions: {
        input: {
          // Primary entry point for the renderer process
          primary: resolve('src/renderer/index.html'),
        },
      },
    },

    resolve: {
      alias: {
        // Root renderer source directory
        '@': resolve('src/renderer/src'),
        '@renderer': resolve('src/renderer/src'),

        // Component library and utilities
        '@/components': resolve('src/renderer/src/components'),
        '@/lib': resolve('src/renderer/src/lib'),
        '@/hooks': resolve('src/renderer/src/hooks'),

        // Shared utilities accessible across all processes
        '@shared': resolve('src/main/shared'),
      },
    },

    plugins: [
      // React Fast Refresh for development
      react(),
      // TailwindCSS with JIT compilation
      tailwindcss(),
    ],
  },
})
