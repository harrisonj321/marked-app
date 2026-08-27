/**
 * The PWA manifest's icon set -- extracted from vite.config.ts so its shape
 * (the `any`/`maskable` split at both sizes, STANDARD.md §15) can be
 * asserted on directly in a test rather than only discovered by inspecting a
 * production build's manifest.webmanifest.
 */
export const PWA_MANIFEST_ICONS = [
  { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  {
    // A separately-composed pair, not the `any` icons relabeled: an `any`
    // icon is trusted to render exactly as authored, but a `maskable` one
    // can be cropped to any shape a launcher picks, so it needs its own
    // generous interior padding to survive that uncropped -- see
    // patterns/pwa-and-installation.md §2.2 in the canonical standard for
    // the full reasoning. Same mark, same cream background, rescaled inward
    // so its farthest point sits at ~28% of the canvas radius --
    // comfortably inside both the W3C-cited 40% safe-zone radius and
    // Android's own stricter 30.55% adaptive-icon safe zone.
    src: 'icon-192-maskable.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'maskable',
  },
  { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
] as const
