/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_REFRESH_PATH?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_SOCKET_PATH?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
