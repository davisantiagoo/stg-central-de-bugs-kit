/**
 * O servidor do SaaS de exemplo: Fastify com uma SESSÃO DE MENTIRA e o plugin
 * da Central de Bugs.
 *
 * A sessão é um cookie com o id de uma das duas pessoas fixas abaixo — o
 * suficiente para mostrar o que importa: o plugin da Central NÃO tem login
 * próprio, ele só pergunta ao SaaS "quem está logado?" pela opção `usuario`.
 * No seu SaaS, `usuario` chama o getter de sessão que você já usa
 * (req.user, req.session, auth.api.getSession…).
 *
 * Duas pessoas para dar para ver que "Meus relatos" é de cada uma: o `id`
 * delas vira o `sub` do token, e a Central separa os relatos por (conexão, sub).
 */
import Fastify, { type FastifyRequest } from 'fastify'
import centralDeBugs from '@stg/central-de-bugs-fastify'

type Usuario = { id: string; nome: string; email: string }

const PESSOAS: Usuario[] = [
  { id: 'usr_marina', nome: 'Marina Lopes', email: 'marina@exemplo.com.br' },
  { id: 'usr_joao', nome: 'João Prado', email: 'joao@exemplo.com.br' },
]

const COOKIE = 'exemplo_sessao'

declare module 'fastify' {
  interface FastifyRequest {
    usuario: Usuario | null
  }
}

/** Lê o cookie à mão para o exemplo não depender de @fastify/cookie. */
function usuarioDaSessao(req: FastifyRequest): Usuario | null {
  const cookies = req.headers.cookie ?? ''
  const valor = cookies.split(';').map((c) => c.trim().split('=')).find(([nome]) => nome === COOKIE)?.[1]
  return PESSOAS.find((p) => p.id === valor) ?? null
}

const app = Fastify({ logger: { level: 'info' } })

app.decorateRequest('usuario', null)
app.addHook('onRequest', async (req) => {
  req.usuario = usuarioDaSessao(req)
})

// ── A Central de Bugs ───────────────────────────────────────────────────────
// Registra GET /api/central-de-bugs/token. A chave privada e o código da conexão
// vêm do ambiente (CENTRAL_DE_BUGS_CHAVE_PRIVADA, CENTRAL_DE_BUGS_CONEXAO). Sem
// eles, o plugin loga o erro e a rota responde 503 — o SaaS continua no ar e o
// widget só esconde o botão.
await app.register(centralDeBugs, {
  usuario: (req) => req.usuario,
})

// ── A "API" do SaaS ─────────────────────────────────────────────────────────

app.get('/api/pessoas', async () => ({ data: PESSOAS.map(({ id, nome }) => ({ id, nome })) }))

app.get('/api/eu', async (req, reply) => {
  if (!req.usuario) return reply.code(401).send({ error: 'Não autenticado' })
  return { data: req.usuario }
})

app.post('/api/entrar', async (req, reply) => {
  const id = (req.body as { id?: unknown } | undefined)?.id
  const pessoa = PESSOAS.find((p) => p.id === id)
  if (!pessoa) return reply.code(422).send({ error: 'Pessoa desconhecida' })
  reply.header('set-cookie', `${COOKIE}=${pessoa.id}; Path=/; HttpOnly; SameSite=Lax`)
  return { data: pessoa }
})

app.post('/api/sair', async (_req, reply) => {
  reply.header('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return { data: null }
})

const PEDIDOS = [
  { id: 812, cliente: 'Cravina Motos', total: 450, canal: 'mercado_livre' },
  { id: 813, cliente: 'Loja Aurora', total: 1290.9, canal: 'shopee' },
]

app.get('/api/pedidos', async (req, reply) => {
  if (!req.usuario) return reply.code(401).send({ error: 'Não autenticado' })
  return { data: PEDIDOS }
})

// Falha de propósito: o rastro do widget guarda o método, o caminho (sem a
// query), o status e o `error`/`code` do JSON — e é isso que aparece no relato.
app.post('/api/pedidos/:id/publicar', async (req, reply) => {
  if (!req.usuario) return reply.code(401).send({ error: 'Não autenticado' })
  return reply.code(500).send({ error: 'Canal de venda recusou a publicação', code: 'CANAL_RECUSOU' })
})

const porta = Number(process.env.PORTA ?? 3000)
await app.listen({ port: porta, host: '127.0.0.1' })
