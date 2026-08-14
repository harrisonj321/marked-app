/**
 * True once the app is already running as an installed PWA (launched from
 * a Home Screen icon, not a browser tab) -- on iOS that state is only
 * exposed via the legacy `navigator.standalone` property, not the
 * display-mode media query.
 */
export function isStandaloneDisplay(): boolean {
  const legacyNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || legacyNavigator.standalone === true
}

/**
 * Mirrors the CSS `prefers-reduced-motion: reduce` media query for the few
 * places where JS must know whether entrance animations will actually play
 * -- e.g. whether to move focus immediately or wait for an animationend
 * that would otherwise never fire.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * iOS/iPadOS never fires `beforeinstallprompt`, so install guidance there
 * has to fall back to written Share-sheet instructions. iPadOS 13+ reports
 * itself as a Mac in the user agent, so touch-point count is what actually
 * distinguishes an iPad from real desktop Safari.
 */
export function isIOSDevice(): boolean {
  const isIOSUserAgent = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isIPadOS13Up = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isIOSUserAgent || isIPadOS13Up
}
