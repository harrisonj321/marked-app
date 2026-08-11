import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json' with { type: 'json' }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Noted.',
        short_name: 'Noted.',
        description: 'A private personal observation log.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        background_color: '#faf6ee',
        theme_color: '#faf6ee',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Firestore Rules tests run separately against the emulator, see
    // vitest.rules.config.ts and the "test:rules" script.
    exclude: [...configDefaults.exclude, 'tests/**'],
  },
})
