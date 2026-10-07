# Guia: instalar a Central de Bugs à mão

Este é o mesmo caminho que a skill `instalar-central-de-bugs` segue, para quem prefere fazer à
mão ou quer entender o que o agente fez. O stack é o da Central: **React + Vite** no front e
**Fastify + Node** no servidor.

Ao final:

- quem usa o seu SaaS tem um botão **"Bug ou sugestão"**;
- cada relato vira uma tarefa na lista **Bugs** ou **Melhorias** de uma pasta da Central, com o
  print, o contexto da tela e o rastro técnico;
- quem relatou acompanha tudo em **"Meus relatos"**, dentro do próprio SaaS.

| Peça | Onde roda | Pacote |
| --- | --- | --- |
| Widget `<CentralDeBugs>` | front do SaaS | `@stg/central-de-bugs` |
| Rota do token (assina quem relata) | servidor do SaaS | `@stg/central-de-bugs-fastify` |
| CLI: chaves, simulador, verificação | máquina do dev | `@stg/central-de-bugs-cli` (binário `central-de-bugs`) |
| Listas, conexão e tarefas | Central (`https://app.stgcompany.com.br`) | — |

## 0. Antes de começar

- **Conta na Central** com acesso ao módulo MCP, se for instalar pelo agente. Quem convida e
  libera é o administrador da Central.
- **Acesso total** (compartilhamento "acesso total", o nível `manage`) na pasta onde as listas
  vão nascer. Conectar um SaaS abre a lista para os usuários dele. Por isso a decisão é de quem
  administra a pasta.
- **React 19+** no front e **Fastify 5** no servidor.

## 1. Versão atual dos pacotes

Os pacotes não estão em registry nenhum. Eles são arquivos `.tgz` anexados a um
[Release](https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases) deste repositório,
que é público, e se instalam pela URL, **sem token e sem `.npmrc`**.

Este bloco é o **único lugar do guia** com a versão. Cole-o no terminal antes do passo 2; para
trocar de versão, troque só ele.

```bash
# Versão atual dos pacotes da Central de Bugs: 0.2.0 (Release pacotes-v0.2.0)
CDB_WIDGET=https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-0.2.0.tgz
CDB_FASTIFY=https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-fastify-0.2.0.tgz
CDB_CLI=https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-cli-0.2.0.tgz
```

| Variável | Pacote | O que é |
| --- | --- | --- |
| `CDB_WIDGET` | `@stg/central-de-bugs` | o widget React, no front |
| `CDB_FASTIFY` | `@stg/central-de-bugs-fastify` | o plugin do token, no servidor |
| `CDB_CLI` | `@stg/central-de-bugs-cli` | a CLI `central-de-bugs`, na máquina do dev |

No `package.json`, a dependência fica com o nome do pacote e a URL no lugar da versão
(`"@stg/central-de-bugs": "https://github.com/…/stg-central-de-bugs-<versão>.tgz"`). O
`package-lock.json` guarda a URL e o hash do arquivo, então o `npm ci` do build baixa exatamente
o mesmo `.tgz`. As dependências dos pacotes (zod, jose, modern-screenshot) vêm do npm público,
como qualquer outra.

**Atualizar** é instalar as URLs da versão nova, o que reescreve a entrada no `package.json` e no
lock. O que mudou em cada versão está no [CHANGELOG](../CHANGELOG.md).

## 2. Instalar os pacotes

Com as variáveis do passo 1 no terminal:

```bash
npm install "$CDB_WIDGET"           # no workspace do front
npm install "$CDB_FASTIFY"          # no workspace do servidor
npm install -D "$CDB_CLI"           # onde for mais à mão (raiz ou servidor)
npx central-de-bugs --ajuda
```

Com pnpm ou yarn, o comando é o mesmo trocando `npm install` por `pnpm add` ou `yarn add`. O
widget pede React 19+ e o plugin pede Fastify 5 (são `peerDependencies`: o SaaS já os tem).

**Se a instalação falhar:**

- **404 na URL:** a versão não existe. Confira o bloco do passo 1 e a lista de
  [Releases](https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases).
- **`ERESOLVE` com `react` ou `fastify`:** o SaaS está abaixo do React 19 ou do Fastify 5.
- **Rede que bloqueia o GitHub:** os `.tgz` vêm de `github.com`, que redireciona o download
  para um domínio `*.githubusercontent.com`. O build (Coolify) precisa alcançar os dois.

## 3. Gerar o par de chaves

O servidor do SaaS assina a identidade de quem relata com uma **chave privada** que só ele tem.
A Central confere com a **pública**. A privada é gerada na sua máquina e nunca vai para a
Central, para o navegador nem para o agente.

1. O arquivo `.env` que o **servidor** lê precisa estar no `.gitignore`:

   ```bash
   git check-ignore -q .env && echo "ok, ignorado"
   ```

2. Gere:

   ```bash
   npx central-de-bugs chaves --env .env
   ```

   - grava `CENTRAL_DE_BUGS_CHAVE_PRIVADA=<base64url da JWK privada>` no `.env`, sem imprimir;
   - imprime no stdout **só a pública**, uma linha de JSON:
     `{"kty":"EC","crv":"P-256","x":"…","y":"…","kid":"…","alg":"ES256","use":"sig"}`;
   - recusa gravar se o `.env` não estiver ignorado, e recusa trocar uma chave que já existe.
     Para isso existe `--forcar`.

   Para rever a pública depois: `npx central-de-bugs chave-publica --env .env`.

**Nunca** dê à chave privada um nome com `VITE_`. Tudo que começa com `VITE_` vai para o
JavaScript que o navegador baixa. Confira também que o `vite.config` não tem um `envPrefix`
que case com `CENTRAL_DE_BUGS_` nem um `define` que injete `process.env` inteiro.

## 4. Criar as listas e a conexão na Central

**Pelo agente** (recomendado): no Claude Code, com o plugin `central-de-bugs@stg`, diga
"instala a Central de Bugs aqui". O MCP da Central pede o login (OAuth) e oferece as pastas em
que você tem acesso total. A ferramenta `instalar_central_de_bugs` cria, numa transação:

- a lista **Bugs** com os status Novo · Em análise · Precisa de informação · Em correção ·
  Corrigido · Não reproduzi · Duplicado · Não é bug;
- a lista **Melhorias** com os status Nova · Em avaliação · Precisa de informação · Planejada ·
  Em desenvolvimento · Entregue · Já existe · Não vamos fazer;
- a **conexão**, com o nome do SaaS, as origens, o responsável e a chave pública. Ela nasce em
  **modo teste**.

A resposta traz o **código da conexão** (`cdb_` + 20 letras/dígitos), que é público.

**Pela tela da Central:** "Instalar Central de Bugs" no menu da pasta, ou "Conectar a listas
existentes" para usar duas listas de tarefas que já existem e em que você tem acesso total. Cole
a chave **pública** da etapa 3. Se colar a privada, a Central recusa e a chave passa a ser
considerada comprometida: gere outra.

**Origens** são os endereços de onde o navegador do SaaS chama a Central, no formato
`https://host[:porta]`, sem caminho, sem barra final e sem curinga. `http://localhost:*` e
`http://127.0.0.1:*` só valem enquanto a conexão está em modo teste.

## 5. Servidor: a rota do token

```ts
import centralDeBugs from '@stg/central-de-bugs-fastify'

// Depois da autenticação do SaaS, no mesmo contexto das rotas que leem a sessão.
await app.register(centralDeBugs, {
  usuario: async (req) => {
    const sessao = await getSessao(req)          // o getter que o SaaS já usa
    if (!sessao) return null                      // → 401: sem usuário, sem relato
    return { id: sessao.usuario.id, nome: sessao.usuario.nome, email: sessao.usuario.email }
  },
})
```

| Opção | Padrão | O que é |
| --- | --- | --- |
| `usuario(req)` | obrigatória | quem está logado no SaaS, ou `null` |
| `chavePrivada` | `process.env.CENTRAL_DE_BUGS_CHAVE_PRIVADA` | base64url do JSON da JWK privada |
| `conexao` | `process.env.CENTRAL_DE_BUGS_CONEXAO` | o código `cdb_…` |
| `rota` | `/api/central-de-bugs/token` | onde o widget busca o token |
| `duracaoS` | `600` | validade do token, de 1 a 900 segundos |

- `GET /api/central-de-bugs/token` responde **200** `text/plain` com o JWT (ES256, com `kid` no
  cabeçalho), **401** `{ code: "SEM_USUARIO" }` sem sessão e **503**
  `{ code: "CENTRAL_DE_BUGS_NAO_CONFIGURADA" }` se a chave ou a conexão estiverem erradas no
  ambiente. Uma configuração errada **não derruba o SaaS**: o erro sai no log do boot e o widget
  esconde o botão.
- `id` vira o `sub` do token, que é a identidade da pessoa em "Meus relatos". Use um id estável
  (nunca o e-mail), com no máximo 128 caracteres. Se ids se repetem entre clientes, use
  `${tenantId}:${userId}`.
- `email` é opcional e só serve ao aviso por e-mail, que vem desligado por padrão na conexão.
- Para assinar fora da rota pronta, use
  `assinarTokenDeRelato(chavePrivada, conexao, { id, nome, email? }, duracaoS?)`, exportada pelo
  mesmo pacote.

## 6. Front: o widget

```tsx
import { CentralDeBugs, registrar } from '@stg/central-de-bugs'

const CONEXAO = import.meta.env.VITE_CENTRAL_DE_BUGS_CONEXAO
const CENTRAL = import.meta.env.VITE_CENTRAL_DE_BUGS_URL

// Na raiz da área LOGADA.
{CONEXAO && CENTRAL && (
  <CentralDeBugs
    conexao={CONEXAO}
    central={CENTRAL}
    token={async () => {
      const r = await fetch('/api/central-de-bugs/token', { credentials: 'include' })
      if (!r.ok) throw new Error(`token: ${r.status}`)
      return r.text()
    }}
    contexto={() => ({
      lojista: { valor: lojista.nome, id: lojista.id },
      catalogo_ativo: catalogo ? { valor: catalogo.nome, id: catalogo.id } : null,
      canal_de_venda: canal,
      cnpj_do_lojista: { valor: lojista.cnpj, sensivel: true },
    })}
  />
)}
```

| Prop | Obrigatória | O que é |
| --- | --- | --- |
| `conexao` | sim | o código `cdb_…` |
| `central` | sim | `https://app.stgcompany.com.br` (ou o simulador, em dev) |
| `token` | sim | `() => Promise<string>`: busca o JWT na rota do plugin |
| `contexto` | — | `() => Record<string, ValorContexto>`, lido no momento do relato |
| `perguntas` | — | até 8 perguntas extras no formulário; opções podem ter ícone (veja abaixo) |
| `versao` | — | versão ou SHA do build (um SHA vira os 12 primeiros caracteres) |
| `tela` | — | `() => string`, o nome legível da tela ("Pedidos › #812"). Padrão: o título da página |
| `raizDoPrint` | — | `() => HTMLElement \| null`, o elemento fotografado. Padrão: o `body` |
| `posicao` | — | `'direita'` (padrão) ou `'esquerda'` |
| `textos` | — | `Partial<Textos>`, para trocar qualquer texto do widget (veja `TEXTOS_PADRAO`) |
| `tema` | — | `Partial<Tema>`: cores, `raio`, `fonte`, `zIndex` e `esquema` (`'auto' \| 'claro' \| 'escuro'`) |

**Contexto** (`ValorContexto`): um primitivo (texto, número, booleano ou `null`) ou
`{ valor, rotulo?, id?, sensivel? }`. Cada chave segue `^[a-z][a-z0-9_]{0,39}$`, até 20
itens. Chave em camelCase é convertida com aviso no console. Com `sensivel: true` o valor
**não entra na descrição** da tarefa: fica só na ficha do relato. Nunca coloque segredo
(token, senha, chave de API).

**Perguntas** (`PerguntaExtra`):
`{ chave, rotulo, tipo: 'texto' | 'opcao' | 'numero' | 'sim_nao', opcoes?, obrigatoria?, so_em?: 'bug' | 'sugestao', ajuda? }`.

`opcoes` (obrigatório em `tipo: 'opcao'`) aceita texto ou objeto, misturados
(`OpcaoDaPergunta`, desde a 0.2.0):

- texto, como antes: `'Matriz'` é o valor e o rótulo ao mesmo tempo;
- `{ valor, rotulo?, icone?, descricao? }`: `valor` (texto, único na pergunta) é o que vai
  gravado na resposta; `rotulo` é o que a pessoa lê (padrão: o `valor`); `icone` é um nó React
  qualquer, normalmente um ícone que o SaaS já usa; `descricao` é uma linha discreta embaixo do
  rótulo, no seletor.

Até 6 opções viram pílulas (com o ícone, se houver). Mais que 6 viram um seletor do próprio
widget: campo com o ícone e o rótulo escolhidos, lista com ícone e descrição, busca a partir de
9 opções, teclado completo (setas, Home/End, Enter, Esc, digitar para pular) e tema
claro/escuro. A resposta gravada na Central é sempre o `valor`, nunca o rótulo.

O widget não traz biblioteca de ícones nem baixa nada: o ícone é do SaaS. Use o mesmo pacote
de ícones do seu front (lucide-react, heroicons, um `<svg>` seu), com ~14–16px e
`currentColor`, para o ícone seguir o tema do widget. Ele é decorativo: o leitor de tela lê o
`rotulo`.

```tsx
import { Bike, Store, Truck } from 'lucide-react' // o pacote de ícones do próprio SaaS
import type { PerguntaExtra } from '@stg/central-de-bugs'

const PERGUNTAS: PerguntaExtra[] = [
  {
    chave: 'entrega',
    rotulo: 'Como o pedido chega ao cliente?',
    tipo: 'opcao',
    so_em: 'bug',
    opcoes: [
      { valor: 'transportadora', rotulo: 'Transportadora', icone: <Truck size={15} />, descricao: 'Correios ou frete contratado' },
      { valor: 'motoboy', rotulo: 'Motoboy', icone: <Bike size={15} /> },
      { valor: 'retirada', rotulo: 'Retirada na loja', icone: <Store size={15} /> },
      'Outro', // texto continua valendo
    ],
  },
]
```

Mudar só o ícone (por exemplo, com o tema do SaaS) não refaz a validação das perguntas: o
widget compara a estrutura sem os ícones e usa sempre os ícones do render atual.

**Eventos do domínio:** `registrar(nome, detalhes?)` guarda os últimos 30, com até 10 detalhes
planos cada. Eles entram em "Últimos eventos" dos relatos de **bug**.

```ts
registrar('produto publicado', { produto_id: 812, canal: 'mercado_livre' })
```

**Abrir de outro lugar:** `abrirCentralDeBugs(tipo?, aba?)`, por exemplo
`abrirCentralDeBugs('sugestao')` ou `abrirCentralDeBugs(undefined, 'meus')`.

**Fora do print:** `data-relato-ignorar` em qualquer elemento
([privacidade.md](privacidade.md)).

**Tipos das variáveis** em `vite-env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly VITE_CENTRAL_DE_BUGS_CONEXAO?: string
  readonly VITE_CENTRAL_DE_BUGS_URL?: string
}
```

## 7. Testar no simulador

```bash
npx central-de-bugs simular --env .env --nome "Meu SaaS"
```

O simulador implementa a API externa inteira, com a mesma validação e a mesma montagem de
descrição da Central (o código é o mesmo pacote de contrato), e guarda tudo em memória. Para
usar:

- servidor: `CENTRAL_DE_BUGS_CONEXAO=cdb_simulador00000000000`;
- front: `VITE_CENTRAL_DE_BUGS_CONEXAO=cdb_simulador00000000000` e
  `VITE_CENTRAL_DE_BUGS_URL=http://localhost:4545`.

No painel `http://localhost:4545/painel` estão a descrição de cada relato como a tarefa ficaria,
os anexos, o `extra` (com os sensíveis marcados) e o token decodificado. Ali também dá para
mudar status e fazer perguntas, e ver "Meus relatos" e a conversa funcionando no widget.

Opções: `--porta`, `--nome` e `--modo-teste` (o envio devolve a descrição e não vira tarefa,
como na Central em modo teste). O simulador não aplica os limites por hora da Central, para não
atrapalhar os testes.

O [exemplo/](../exemplo) é um SaaS mínimo pronto para rodar contra o simulador.

## 8. Conferir a conexão real

```bash
npx central-de-bugs verificar --central https://app.stgcompany.com.br --conexao cdb_… --env .env --origem https://app.meusaas.com.br
```

O comando assina um token com a sua chave e chama `/estado` na Central. Ele diz o nome da
conexão, se está em modo teste, que tipos recebe e se a origem passa no CORS. Se falhar, explica
o motivo: **401** é chave diferente da cadastrada ou relógio fora, **404** é código errado,
**410** é conexão desligada e **403** é origem não permitida.

## 9. Produção (Coolify)

Variáveis da aplicação:

| Variável | Tipo no Coolify | Valor |
| --- | --- | --- |
| `CENTRAL_DE_BUGS_CHAVE_PRIVADA` | runtime, **secreta** | copiada do seu `.env` pelo editor, nunca por chat |
| `CENTRAL_DE_BUGS_CONEXAO` | runtime | `cdb_…` |
| `VITE_CENTRAL_DE_BUGS_CONEXAO` | **build** (o Vite embute no build) | `cdb_…` |
| `VITE_CENTRAL_DE_BUGS_URL` | **build** | `https://app.stgcompany.com.br` |

O build não precisa de token nem de `.npmrc`: o `npm ci` baixa os `.tgz` pelas URLs públicas
gravadas no `package-lock.json`, junto com o resto das dependências.

Depois do deploy:

1. **Relate algo de verdade em produção.** Em modo teste nada vira tarefa: a confirmação do
   widget mostra a descrição, e a tela da conexão na Central lista os últimos 20 testes.
2. **Saia do modo teste**, pela tela da conexão ou pedindo ao agente ("sai do modo teste da
   Central de Bugs"). A partir daí cada relato vira tarefa, e `localhost` deixa de ser aceito.

## 10. Depois

- **Corrigir:** no Claude Code, "corrige o bug #812" (skill `corrigir-relato`).
- **Triar:** "tria os bugs do Meu SaaS" (skill `triar-relatos`).
- **Trocar a chave** (rotação): `npx central-de-bugs chaves --env .env --forcar` gera outra.
  Cadastre a nova pública na tela da conexão, e a anterior continua valendo por 24h. Atualize o
  Coolify e faça o deploy dentro dessas 24h.
- **Origens, responsável, e-mail para quem relatou, desligar:** tudo pela tela da conexão.
- A conexão é **das listas**, não de quem instalou: qualquer pessoa com acesso total nelas a vê
  e administra.
