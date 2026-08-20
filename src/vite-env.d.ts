/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TITLE: string
  readonly VITE_BASE: string
  readonly VITE_NODE_ENV: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_KEY: string
  readonly VITE_USE_HASH: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
