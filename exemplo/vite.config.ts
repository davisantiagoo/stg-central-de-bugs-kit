import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// O front chama a API do próprio SaaS por caminho relativo (/api/…), e o Vite
// encaminha para o Fastify — o mesmo arranjo de produção atrás de um proxy.
// A rota do token (/api/central-de-bugs/token) passa por aqui junto com o resto.
//
// NUNCA mude o envPrefix para algo que case com CENTRAL_DE_BUGS_CHAVE_PRIVADA:
// tudo que o Vite expõe vai para o JavaScript que o navegador baixa.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
})
