/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SMART_WALLET_AI_URL: string
  readonly VITE_BACKEND_URL: string
  readonly VITE_TELEGRAM_BOT_SERVER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 