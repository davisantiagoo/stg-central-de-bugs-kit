/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** O código da conexão (`cdb_…`). Público. No simulador: cdb_simulador00000000000. */
  readonly VITE_CENTRAL_DE_BUGS_CONEXAO?: string
  /** A Central (https://app.stgcompany.com.br) ou o simulador (http://localhost:4545). */
  readonly VITE_CENTRAL_DE_BUGS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
