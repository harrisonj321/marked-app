/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** Dev/preview-only: forces the pre-auth onboarding/orientation to show on every fresh load, ignoring stored completion. See App.tsx. */
  readonly VITE_FORCE_ONBOARDING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
