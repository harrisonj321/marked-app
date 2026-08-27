import { describe, expect, it } from 'vitest'
import { PWA_MANIFEST_ICONS } from './pwaIcons'

/**
 * The Phase 4 PWA compliance gap this migration closes: `STANDARD.md` §15
 * and `patterns/pwa-and-installation.md` §2.2 require a 192/512 `any`-purpose
 * pair AND a *separately composed* 192/512 `maskable`-purpose pair -- four
 * files, not two, and not the `any` icons relabeled. This asserts the shape
 * directly, so a future edit that collapses the pair back to two icons (or
 * relabels one) fails a test rather than only being discovered by inspecting
 * a production manifest.webmanifest by hand.
 */
describe('PWA manifest icons', () => {
  it('declares exactly four icons: any + maskable, at both 192 and 512', () => {
    expect(PWA_MANIFEST_ICONS).toHaveLength(4)
  })

  it('has a 192 and a 512 any-purpose icon', () => {
    const any192 = PWA_MANIFEST_ICONS.find((icon) => icon.purpose === 'any' && icon.sizes === '192x192')
    const any512 = PWA_MANIFEST_ICONS.find((icon) => icon.purpose === 'any' && icon.sizes === '512x512')
    expect(any192).toMatchObject({ src: 'icon-192.png', type: 'image/png' })
    expect(any512).toMatchObject({ src: 'icon-512.png', type: 'image/png' })
  })

  it('has a genuinely separate 192 and 512 maskable-purpose icon, not the any icons relabeled', () => {
    const maskable192 = PWA_MANIFEST_ICONS.find(
      (icon) => icon.purpose === 'maskable' && icon.sizes === '192x192',
    )
    const maskable512 = PWA_MANIFEST_ICONS.find(
      (icon) => icon.purpose === 'maskable' && icon.sizes === '512x512',
    )
    expect(maskable192).toMatchObject({ src: 'icon-192-maskable.png', type: 'image/png' })
    expect(maskable512).toMatchObject({ src: 'icon-512-maskable.png', type: 'image/png' })
    // Distinct filenames from the any-purpose pair -- the actual defect
    // §2.2 warns about (purpose: 'any maskable' pointed at one shared file).
    expect(maskable192?.src).not.toBe(PWA_MANIFEST_ICONS.find((i) => i.sizes === '192x192' && i.purpose === 'any')?.src)
    expect(maskable512?.src).not.toBe(PWA_MANIFEST_ICONS.find((i) => i.sizes === '512x512' && i.purpose === 'any')?.src)
  })

  it('never combines any and maskable on the same manifest entry', () => {
    for (const icon of PWA_MANIFEST_ICONS) {
      expect(icon.purpose).not.toContain(' ')
    }
  })
})
