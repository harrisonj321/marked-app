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
      workbox: {
        // The generated service worker's default SPA navigation fallback
        // (see dist/sw.js's NavigationRoute) otherwise intercepts EVERY
        // top-level navigation in scope, including signInWithRedirect's
        // navigation to /__/auth/handler -- serving the cached app shell
        // instead of letting that request reach the network and Vercel's
        // /__/auth/:path* proxy (see vercel.json) to Firebase's real auth
        // handler. That silently breaks the entire Google OAuth handshake
        // on any device where the service worker is already active: this
        // is the real, reproducible cause of the "stuck after Google
        // sign-in" hang, confirmed by inspecting the built dist/sw.js, not
        // guessed. Denylisting the auth proxy path lets it hit the network
        // like any other cross-origin-bound request.
        navigateFallbackDenylist: [/^\/__\/auth\//],
      },
      manifest: {
        name: 'Noted.',
        short_name: 'Noted.',
        description: 'A private personal observation log.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        background_color: '#f6f0e4',
        theme_color: '#f6f0e4',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // The mark sits well inside the maskable safe zone on a full-bleed
            // background, so the same artwork serves both purposes unaltered.
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
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
