/**
 * O front do SaaS de exemplo. O que interessa para a Central de Bugs está em
 * três lugares, marcados com ◆:
 *
 *  ◆ <CentralDeBugs> montado SÓ na área logada — fora dela a rota do token
 *    responde 401 e não haveria quem relatar;
 *  ◆ registrar(…) nos fluxos do domínio (abrir pedido, publicar);
 *  ◆ data-relato-ignorar no painel com dado sensível (fica fora do print).
 */
import { useEffect, useState } from 'react'
import { CentralDeBugs, abrirCentralDeBugs, registrar, type PerguntaExtra } from '@stg/central-de-bugs'

type Pessoa = { id: string; nome: string }
type Pedido = { id: number; cliente: string; total: number; canal: string }

const CONEXAO = import.meta.env.VITE_CENTRAL_DE_BUGS_CONEXAO
const CENTRAL = import.meta.env.VITE_CENTRAL_DE_BUGS_URL

/** Pergunta a mais no formulário de bug: o que o código não tem como saber sozinho. */
const PERGUNTAS: PerguntaExtra[] = [
  {
    chave: 'canal_afetado',
    rotulo: 'Em qual canal de venda aconteceu?',
    tipo: 'opcao',
    opcoes: ['Mercado Livre', 'Shopee', 'Loja própria', 'Todos'],
    so_em: 'bug',
  },
]

async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(caminho, { credentials: 'include', ...init })
  const corpo = await r.json().catch(() => null) as { data?: T; error?: string } | null
  if (!r.ok) throw new Error(corpo?.error ?? `HTTP ${r.status}`)
  return corpo?.data as T
}

export function App() {
  const [eu, setEu] = useState<Pessoa | null | undefined>(undefined)

  useEffect(() => {
    api<Pessoa>('/api/eu').then(setEu, () => setEu(null))
  }, [])

  if (eu === undefined) return <p className="carregando">Carregando…</p>
  if (!eu) return <Entrar onEntrou={setEu} />
  return <AreaLogada eu={eu} onSaiu={() => setEu(null)} />
}

function Entrar({ onEntrou }: { onEntrou: (p: Pessoa) => void }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  useEffect(() => { api<Pessoa[]>('/api/pessoas').then(setPessoas, () => setPessoas([])) }, [])
  return (
    <main className="entrar">
      <h1>Exemplo de SaaS</h1>
      <p>Sessão de mentira: escolha quem você é.</p>
      {pessoas.map((p) => (
        <button key={p.id} type="button" onClick={async () => {
          onEntrou(await api<Pessoa>('/api/entrar', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id }),
          }))
        }}>
          Entrar como {p.nome}
        </button>
      ))}
    </main>
  )
}

function AreaLogada({ eu, onSaiu }: { eu: Pessoa; onSaiu: () => void }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [aberto, setAberto] = useState<Pedido | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => { api<Pedido[]>('/api/pedidos').then(setPedidos, () => setPedidos([])) }, [])

  function abrir(pedido: Pedido) {
    setAberto(pedido)
    setAviso(null)
    // ◆ Evento do domínio: aparece em "Últimos eventos" do relato de bug.
    registrar('pedido aberto', { pedido_id: pedido.id, canal: pedido.canal })
  }

  async function publicar(pedido: Pedido) {
    try {
      await api(`/api/pedidos/${pedido.id}/publicar`, { method: 'POST' })
      registrar('pedido publicado', { pedido_id: pedido.id, canal: pedido.canal })
    } catch (erro) {
      // A requisição que falhou já entra sozinha no rastro técnico; o evento
      // diz, na língua do domínio, o que a pessoa estava fazendo.
      registrar('publicacao falhou', { pedido_id: pedido.id, canal: pedido.canal })
      setAviso(`Não foi possível publicar: ${(erro as Error).message}. Use o botão "Bug ou sugestão" para relatar.`)
    }
  }

  return (
    <div className="app">
      <header className="topo">
        <strong>Exemplo de SaaS</strong>
        <span>{eu.nome}</span>
        {/* Abrir a Central de um menu do próprio SaaS, além do botão flutuante. */}
        <button type="button" onClick={() => abrirCentralDeBugs('sugestao')}>Sugerir melhoria</button>
        <button type="button" onClick={() => abrirCentralDeBugs(undefined, 'meus')}>Meus relatos</button>
        <button type="button" onClick={async () => { await api('/api/sair', { method: 'POST' }); onSaiu() }}>Sair</button>
      </header>

      <main className="conteudo">
        <section>
          <h2>Pedidos</h2>
          <ul className="pedidos">
            {pedidos.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => abrir(p)}>#{p.id} · {p.cliente}</button>
              </li>
            ))}
          </ul>
        </section>

        {aberto && (
          <section>
            <h2>Pedido #{aberto.id}</h2>
            <p>{aberto.cliente} · R$ {aberto.total.toFixed(2)} · {aberto.canal}</p>
            <button type="button" onClick={() => publicar(aberto)}>Publicar no canal</button>
            {aviso && <p className="aviso" role="alert">{aviso}</p>}

            {/* ◆ Dado sensível: este painel NUNCA aparece no print do relato. */}
            <div className="sensivel" data-relato-ignorar="">
              <h3>Dados do titular</h3>
              <p>CPF 123.456.789-09 · Cartão final 4242</p>
            </div>
          </section>
        )}
      </main>

      {/* ◆ A Central de Bugs. Só monta se o front souber para onde mandar. */}
      {CONEXAO && CENTRAL && (
        <CentralDeBugs
          conexao={CONEXAO}
          central={CENTRAL}
          token={async () => {
            const r = await fetch('/api/central-de-bugs/token', { credentials: 'include' })
            if (!r.ok) throw new Error(`token da Central de Bugs: HTTP ${r.status}`)
            return r.text()
          }}
          // Lido no momento do relato, nunca perguntado à pessoa.
          contexto={() => ({
            plano: 'pro',
            // Só o que existe na tela agora: um item vazio seria uma linha "—" na tarefa.
            ...(aberto ? {
              pedido_aberto: { valor: aberto.cliente, id: aberto.id },
              canal_de_venda: aberto.canal,
              // Sensível: fica no relato, mas NUNCA entra na descrição da tarefa.
              cpf_do_titular: { valor: '123.456.789-09', rotulo: 'CPF do titular', sensivel: true },
            } : {}),
          })}
          perguntas={PERGUNTAS}
          tela={() => (aberto ? `Pedidos › #${aberto.id}` : 'Pedidos')}
        />
      )}
    </div>
  )
}
