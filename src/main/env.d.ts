/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string
  readonly VITE_TRPC_HTTP_URL: string
  readonly MAIN_VITE_POSTGRES_URL: string
  readonly VITE_LMSTUDIO_LLM_SERVER_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
