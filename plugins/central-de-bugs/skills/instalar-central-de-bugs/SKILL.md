---
name: instalar-central-de-bugs
description: Instala a Central de Bugs da STG no SaaS deste repositório (React + Vite no front, Fastify no servidor). Cria as listas Bugs e Melhorias numa pasta da Central pelo MCP, gera o par de chaves (a privada fica só no .env), monta o widget <CentralDeBugs>, registra o plugin Fastify do token, propõe contexto() e registrar(), marca as telas sensíveis e testa tudo no simulador. Use quando pedirem para "instalar a Central de Bugs", "ligar este SaaS à Central de Bugs", "pôr o botão de bug" ou "sair do modo teste" da Central de Bugs.
argument-hint: "[nome do SaaS]"
---

# Instalar a Central de Bugs neste SaaS

Você vai ligar o SaaS deste repositório à Central de Bugs da STG. Os relatos de quem usa o SaaS
viram tarefas nas listas **Bugs** e **Melhorias** de uma pasta da Central. A Central fica em
`https://app.stgcompany.com.br`, e o MCP dela é o servidor `central-de-bugs` deste plugin
(no `/mcp` ele aparece como `plugin:central-de-bugs:central-de-bugs`).

O dev só faz duas coisas: o login na Central (OAuth, no navegador) e as escolhas que você
pedir. O resto é seu, passo a passo, **sempre mostrando antes de alterar**.

Se o pedido for só **sair do modo teste**, pule direto para a seção "Sair do modo teste" no fim.

## Regras que valem do primeiro ao último passo

1. **A chave privada nunca passa por você.** Ela é gerada pela CLI direto no arquivo `.env`.
   Nunca rode `cat`, `grep`, `sed`, `head` ou `Read` num arquivo que tenha
   `CENTRAL_DE_BUGS_CHAVE_PRIVADA`. Para saber se a chave existe, use
   `npx central-de-bugs chave-publica --env <arquivo>`, que só imprime a pública. Se a privada
   aparecer na conversa por qualquer motivo, diga ao dev que ela está comprometida e gere outra
   com `npx central-de-bugs chaves --env <arquivo> --forcar`.
2. **Recuse `VITE_` na chave privada.** Tudo que começa com `VITE_` vai para o JavaScript que o
   navegador baixa. A chave privada só existe no servidor, com o nome
   `CENTRAL_DE_BUGS_CHAVE_PRIVADA`. Se o dev pedir outra coisa, explique e recuse.
3. **O `.env` nunca vai para o git.** Confira com `git check-ignore` antes de gravar qualquer
   coisa nele (a CLI também confere e recusa).
4. **Os pacotes não pedem token.** Eles se instalam pelas URLs públicas do Release do kit
   (Passo 2). Não crie `.npmrc`, não peça token do GitHub nem login no npm. Se o dev colar
   um token qualquer na conversa, não o repita e recomende revogá-lo.
5. **Escrita na Central só com `dry_run` primeiro.** Chame `instalar_central_de_bugs` e
   `sair_do_modo_teste` primeiro com `dry_run: true`, mostre o resultado e espere a confirmação
   do dev. Só depois repita a chamada sem `dry_run`.
6. **Código do SaaS: proponha, mostre e só então aplique.** Vale para `contexto()`,
   `registrar()`, perguntas extras e `data-relato-ignorar`. O dev conhece o domínio, você não.
7. **Nomes exatos.** Pacotes: `@stg/central-de-bugs` (front),
   `@stg/central-de-bugs-fastify` (servidor) e `@stg/central-de-bugs-cli`
   (dev, binário `central-de-bugs`). Variáveis: `CENTRAL_DE_BUGS_CHAVE_PRIVADA` e
   `CENTRAL_DE_BUGS_CONEXAO` no servidor, `VITE_CENTRAL_DE_BUGS_CONEXAO` e
   `VITE_CENTRAL_DE_BUGS_URL` no front. Não invente outros nomes.

Mantenha um checklist dos passos abaixo (TodoWrite, se disponível) e diga ao dev em que passo
você está.

## Passo 1 — Reconhecer o repositório

Leia antes de perguntar qualquer coisa. Descubra e anote:

- **Gerenciador de pacotes:** `package-lock.json` → npm, `pnpm-lock.yaml` → pnpm,
  `yarn.lock` → yarn. Em monorepo, quais workspaces são o front e o servidor.
- **Front:** o pacote com `vite` e `react`. Ache o `vite.config.*`, a porta do dev server
  (`server.port`, padrão 5173), o `envDir` e o `envPrefix` se existirem, e o arquivo de tipos
  `vite-env.d.ts`.
- **Raiz autenticada:** o componente que só renderiza com alguém logado. Pode ser um layout de
  rotas protegidas, um `<RequireAuth>`, um `if (!session) return <Login/>` no `App.tsx` ou um
  provider de sessão. O widget vai lá: fora da área logada, a rota do token responde 401 e o
  botão some.
- **Como o front chama a API do SaaS:** `fetch('/api/…')` relativo com proxy do Vite, outra
  origem com `credentials: 'include'` ou um cliente próprio (`api.get`, axios, ky). A função
  `token` do widget tem que usar **o mesmo caminho** que o SaaS já usa para chamadas
  autenticadas.
- **Servidor:** o pacote com `fastify`. Ache onde o app é montado, onde a autenticação é
  registrada e **como uma rota lê o usuário logado**. Alguns casos comuns:
  `req.user` (@fastify/passport ou JWT), `req.session.user` (@fastify/session),
  `await auth.api.getSession({ headers })` (better-auth) ou um `getUsuario(req)` próprio.
  Anote também o prefixo em que as rotas de API são registradas.
- **Onde o servidor lê o `.env`** (`dotenv`, `--env-file`, `@fastify/env`) e qual arquivo é:
  o `.env` da raiz ou o do workspace do servidor. É nele que a chave privada vai.
- **Nome do SaaS:** `$ARGUMENTS`, se o dev passou. Se não, procure no `package.json`, no README
  e no `<title>` do `index.html`.
- **Origens:** a de desenvolvimento (`http://localhost:<porta do Vite>`) e a de produção
  (`https://…`). Procure em `.env.example`/`.env.sample`, README, Dockerfile, configuração de
  CORS e arquivos de deploy. **Não leia `.env`, `.env.local`, `.env.production` nem nenhum outro
  `.env` de verdade**: numa reinstalação ele já tem `CENTRAL_DE_BUGS_CHAVE_PRIVADA` (regra 1), e
  sempre tem outros segredos do SaaS. Se a origem só estiver num `VITE_*_URL` de um `.env` real,
  imprima só aquela linha, nunca o arquivo:
  `node -e "for (const l of require('fs').readFileSync(process.argv[1],'utf8').split('\\n')) if (/^VITE_[A-Z0-9_]*URL=/.test(l)) console.log(l)" <arquivo>`.
  Na dúvida, pergunte a origem ao dev. Origem é `https://host[:porta]`, sem caminho e sem barra
  final.
- **Playwright:** se `playwright` ou `@playwright/test` está nas dependências.
- **Já instalado?** Procure `@stg/central-de-bugs` no `package.json` e
  `CENTRAL_DE_BUGS_` em `.env.example`. Se já estiver instalado, diga isso ao dev e pergunte o
  que ele quer refazer, em vez de duplicar.

Mostre ao dev um resumo curto do que achou (front, servidor, raiz autenticada, getter da
sessão, arquivo `.env` do servidor, nome, origens) e siga.

**Antes de seguir, confira o vazamento por configuração do Vite:** se o `vite.config` tiver
um `envPrefix` que case com `CENTRAL_DE_BUGS_CHAVE_PRIVADA` (por exemplo `'CENTRAL_'` ou uma
lista que o inclua), ou um `define` que injete `process.env` inteiro, **pare**. Explique que a
chave privada iria para o navegador e proponha a correção antes de qualquer outro passo.

## Passo 2 — Instalar os pacotes

Os pacotes são `.tgz` públicos, anexados ao Release `pacotes-v0.2.0` do repositório
`davisantiagoo/stg-central-de-bugs-kit`. Instalam pela URL, **sem token, sem `.npmrc` e sem
registry**. Versão atual e URLs (as mesmas do `docs/guia.md` do kit, passo 1):

| Pacote | Onde | URL |
| --- | --- | --- |
| `@stg/central-de-bugs` | front | `https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-0.2.0.tgz` |
| `@stg/central-de-bugs-fastify` | servidor | `https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-fastify-0.2.0.tgz` |
| `@stg/central-de-bugs-cli` | dev (devDependency) | `https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-cli-0.2.0.tgz` |

Instale **os três agora**, antes de qualquer outro passo: a CLI gera as chaves no Passo 5 e
sobe o simulador no Passo 12, e todos os comandos `npx central-de-bugs …` desta skill usam a
cópia instalada no repositório.

1. Com o gerenciador do repositório, no workspace certo de cada um. Com npm:

   ```bash
   # no workspace do front
   npm install https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-0.2.0.tgz
   # no workspace do servidor
   npm install https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-fastify-0.2.0.tgz
   # onde fica mais à mão, normalmente na raiz ou no servidor
   npm install -D https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-cli-0.2.0.tgz
   ```

   Num repositório de um pacote só (front e servidor juntos), junte os dois primeiros:
   `npm install <url do widget> <url do fastify>` e depois `npm install -D <url da cli>`. Em
   workspaces npm, acrescente `-w <workspace>`. Com pnpm use `pnpm add` (`-D`, `--filter`), com
   yarn use `yarn add` (`-D`): a URL é a mesma.
2. Confira que `npx central-de-bugs --ajuda` responde, no diretório onde a CLI foi instalada.
3. **Se falhar:**
   - **404 na URL:** a URL foi digitada errada ou a versão não existe. Use as da tabela.
   - **Erro de rede (`ENOTFOUND`, `ECONNRESET`, timeout):** a rede bloqueia o download do
     GitHub (`github.com` redireciona para um domínio `*.githubusercontent.com`). Diga ao dev;
     não tente contornar.
   - **`ERESOLVE` com `react` ou `fastify`:** veja o parágrafo abaixo.

O widget pede React 19 ou mais novo, e o plugin pede Fastify 5. Se o SaaS estiver abaixo
disso, pare e diga ao dev. Não atualize o React nem o Fastify por conta própria.

## Passo 3 — Entrar na Central (MCP) e listar as pastas

Chame a ferramenta **`pastas_para_central_de_bugs`** do MCP da Central. Na
primeira chamada, o Claude Code abre o navegador para o login na Central. Avise o dev antes:
"vai abrir o navegador para você entrar na Central e autorizar".

**Se a ferramenta não existir na sua lista:**

- **O servidor `central-de-bugs` não está conectado ou pede autenticação:** peça ao dev para
  rodar `/mcp`, escolher o `plugin:central-de-bugs:central-de-bugs` e autenticar.
- **O dev já tinha o MCP da Central configurado à mão** (um `central-stg`, ou outro nome, com a
  URL `https://app.stgcompany.com.br/api/mcp`): o Claude Code reconhece servidor duplicado pela
  URL, não pelo nome, e fica com o configurado à mão. No `/mcp`, o do plugin aparece como
  oculto (*hidden*), e as ferramentas vêm do manual — que pode ter sido autorizado sem o escopo
  `central-de-bugs:instalar`. Dois casos:
  - **o manual usa token pessoal da Central (PAT, cabeçalho `Authorization`)**: token pessoal
    NÃO concede a instalação da Central de Bugs. Peça ao dev para remover o manual
    (`claude mcp remove central-stg -s user`, trocando o nome e o escopo `-s` pelos dele —
    `claude mcp list` mostra) e reiniciar o Claude Code; aí vale o do plugin, por OAuth;
  - **o manual usa OAuth**: peça ao dev para, em `/mcp`, escolher esse servidor, limpar a
    autenticação (*Clear authentication*) e autenticar de novo. Sem `oauth.scopes` na
    configuração, o Claude Code pede os escopos que a Central anuncia, e o de instalar está
    entre eles. Se a configuração manual fixar `oauth.scopes` sem `central-de-bugs:instalar`,
    é mais simples removê-la, como no caso anterior.
- **O servidor está conectado, mas as ferramentas da Central de Bugs não aparecem:** o login
  foi feito sem o escopo `central-de-bugs:instalar` (o dev autorizou antes de instalar o plugin,
  ou recusou essa permissão). Peça ao dev para, em `/mcp`, limpar a autenticação do servidor
  da Central e autenticar de novo. Na tela de consentimento da Central tem de aparecer a
  permissão de instalar a Central de Bugs.
- **Um token restrito a algumas listas não instala:** se a ferramenta responder que o token
  "está restrito a algumas listas", o MCP manual usa um PAT criado com recorte de listas.
  Instalar cria listas novas, fora do recorte; o caminho é o do caso do PAT acima.
- **O login é recusado, ou o MCP responde 403:** a pessoa precisa ter conta na Central e
  acesso ao módulo MCP. Quem resolve isso é o administrador da Central (o Davi), que convida a
  pessoa e libera o módulo. Pare até isso estar resolvido.

**Lendo a resposta:** cada pasta vem com
`{ id, caminho, pasta, space: { id, nome }, podeInstalar, jaTem: { bugs, melhorias }, conexao?: { codigo, nome } }`.
`caminho` é o rótulo pronto "Space / Pasta"; `pasta` é só o nome da pasta; `podeInstalar` é
`false` quando a pasta já tem "Bugs" ou "Melhorias".
Só aparecem as pastas em que o dev tem **acesso total** (`manage`). Se a lista vier vazia, ele
não tem acesso total em nenhuma pasta: quem administra o Space precisa compartilhar uma com
ele como "acesso total".

- Pasta com `conexao`: a Central de Bugs **já está instalada** ali, com aquele `codigo`. Não
  instale de novo: **nunca** chame `instalar_central_de_bugs` para ela (a Central recusa, porque a
  pasta já tem as listas) nem para outra pasta do mesmo SaaS (seriam duas conexões e dois pares de
  listas para um produto só). Pergunte se é esse SaaS. Se for, reaproveite a conexão:
  1. Confira se a chave desta máquina é a cadastrada. Rode
     `npx central-de-bugs chave-publica --env <arquivo>` (só imprime a pública; se responder que
     não há chave, gere com `npx central-de-bugs chaves --env <arquivo>`) e depois
     `npx central-de-bugs verificar --central https://app.stgcompany.com.br --conexao <codigo> --env <arquivo>`.
  2. **Passou:** pule para o **Passo 7** com o `codigo` existente.
  3. **401 (chave):** a pública cadastrada é de outra chave. Nenhuma ferramenta MCP troca a
     chave: peça ao dev para abrir **Configurações → Central de Bugs** na Central, escolher a
     conexão, **Trocar a chave** e colar a linha que o `chave-publica` imprimiu. Depois rode o
     `verificar` de novo e siga para o Passo 7.
- Pasta com `jaTem.bugs` ou `jaTem.melhorias` (`podeInstalar: false`) e sem `conexao`: a
  instalação vai recusar, porque nunca reaproveita uma lista em silêncio. Não ofereça essas
  pastas como opção.

## Passo 4 — Perguntar a pasta, o responsável e confirmar nome e origens

Use **AskUserQuestion**, numa chamada só, com até 4 perguntas:

1. **Pasta:** "Em qual pasta da Central ficam os bugs do <SaaS>?". Ofereça até 4 pastas
   elegíveis (`podeInstalar: true`), começando pelas que têm o nome do SaaS, com o `caminho`
   ("Space / Pasta") como rótulo. A opção
   "Outra" deixa o dev digitar o nome de outra pasta da lista.
2. **Responsável:** "Quem recebe os relatos novos?". Opções: "Eu mesmo" e "Outra pessoa".
   Na opção "Outra", o dev digita o nome ou o e-mail. O responsável precisa ter acesso de
   edição na pasta, e a Central confere isso.
3. **Nome do SaaS**, como vai aparecer nas tarefas ("usuário do <nome>"), com o nome que você
   achou como primeira opção.
4. **Origens** (multiSelect): as que você achou, `https://…` de produção e
   `http://localhost:<porta>` de desenvolvimento. Explique que `localhost` só vale enquanto a
   conexão está em modo teste.

## Passo 5 — Gerar o par de chaves

1. Confirme que o arquivo `.env` do servidor (Passo 1) está ignorado:
   `git check-ignore -q <arquivo> && echo ignorado`.
   - Não está ignorado: mostre ao dev a linha que vai acrescentar ao `.gitignore` e aplique.
   - Está versionado (`git ls-files --error-unmatch <arquivo>` acha): **pare**. Explique que ele
     precisa sair do git (`git rm --cached <arquivo>`, um commit) antes de receber uma chave
     privada. Os segredos que já estão nele também devem ser considerados expostos.
2. Rode `npx central-de-bugs chaves --env <arquivo>`.
   - O **stdout** tem uma linha só: a JWK **pública** (`{"kty":"EC","crv":"P-256","x":…,"y":…,"kid":…}`).
     É ela que vai para a Central.
   - O stderr confirma onde a privada foi gravada. A privada não aparece em lugar nenhum.
   - Se responder que o arquivo **já tem** a chave, não troque. Use
     `npx central-de-bugs chave-publica --env <arquivo>` para obter a pública dela. Só gere
     outra (`--forcar`) se o dev pedir uma chave nova.

## Passo 6 — Criar as listas e a conexão na Central

1. Chame **`instalar_central_de_bugs`** com `dry_run: true`:

   ```json
   {
     "pasta": "<id da pasta escolhida>",
     "nome_saas": "<nome do SaaS>",
     "origens": ["https://app.exemplo.com.br", "http://localhost:5173"],
     "responsavel": "<omita para o próprio dev, ou nome/e-mail>",
     "chave_publica": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…", "kid": "…" },
     "dry_run": true
   }
   ```

   `chave_publica` é exatamente a linha que a CLI imprimiu. Nunca mande outra coisa nesse
   campo.

2. Mostre ao dev o que a simulação descreveu: a pasta, as listas "Bugs" e "Melhorias" com os
   status do modelo, o responsável, as origens e o modo teste ligado. Peça a confirmação com
   AskUserQuestion ("Criar agora" / "Ajustar algo").
3. Confirmado, repita a chamada **sem** `dry_run`. A resposta traz
   `{ conexao: { id, codigo, nome, modoTeste }, listas: { bug, sugestao }, links }`. Guarde o
   `codigo` (`cdb_…`), que é público. Mostre ao dev os links das listas.

**Erros e o que fazer.** A ferramenta devolve o erro como **texto** (`isError`), sem código:
reconheça pelo que a mensagem diz. Os códigos internos ficam na coluna do meio só como
referência.

| A mensagem diz | Código interno | O que fazer |
| --- | --- | --- |
| a pasta já tem "Bugs"/"Melhorias" | `MCP_LISTA_JA_EXISTE` | se a pasta tem `conexao`, é a mesma instalação: volte ao Passo 3 (pasta com `conexao`) e **não** instale em outra pasta. Sem `conexao`, volte ao Passo 4 com outra pasta. Nada foi criado |
| o campo levou uma chave **privada** | `MCP_CHAVE_PRIVADA_RECUSADA` | pare. A chave está comprometida: `chaves --forcar` e recomece o Passo 6 com a pública nova |
| não é uma JWK P-256 pública | `MCP_CHAVE_INVALIDA` | use a linha exata do stdout da CLI |
| origem recusada (caminho, `http` fora do localhost, curinga, mais origens que o limite) | `MCP_ORIGEM_INVALIDA` | corrija para `https://host[:porta]` |
| sem acesso total à pasta | `MCP_SEM_ACESSO_DE_GESTAO` | volte ao Passo 3 |
| pasta (ou Space) arquivada | `MCP_PASTA_ARQUIVADA` | volte ao Passo 4 com uma pasta ativa |
| pasta não encontrada | `MCP_PASTA_NAO_ENCONTRADA` | use o `id` que `pastas_para_central_de_bugs` devolveu |
| ninguém com esse nome edita a pasta | `MCP_RESPONSAVEL_SEM_ACESSO` | escolha outra pessoa ou o próprio dev |
| "corresponde a N …" com uma lista de ids | (ambiguidade) | repita com o id ou o e-mail certo da lista |

## Passo 7 — Variáveis de ambiente

**Desenvolvimento local, apontando para o simulador do kit:**

- `.env` do servidor:
  `CENTRAL_DE_BUGS_CONEXAO=cdb_simulador00000000000`. A `CENTRAL_DE_BUGS_CHAVE_PRIVADA` já foi
  gravada no Passo 5.
- `.env` do front (o `envDir` do Vite):
  `VITE_CENTRAL_DE_BUGS_CONEXAO=cdb_simulador00000000000` e
  `VITE_CENTRAL_DE_BUGS_URL=http://localhost:4545`

Use edição de linha específica (acrescentar ou substituir a linha da variável), **sem ler nem
reescrever o arquivo inteiro**: ele tem a chave privada. Um jeito seguro é um script Node
curto que reescreve só as linhas `CENTRAL_DE_BUGS_CONEXAO=`/`VITE_CENTRAL_DE_BUGS_*=` sem
imprimir nada.

**`.env.example`** (este vai para o git): acrescente as quatro variáveis sem valor secreto,
com um comentário dizendo de onde vem cada uma:

```
# Central de Bugs — servidor. A chave privada é gerada por `npx central-de-bugs chaves` e NUNCA vai para o git.
CENTRAL_DE_BUGS_CHAVE_PRIVADA=
CENTRAL_DE_BUGS_CONEXAO=<codigo cdb_… da instalação; cdb_simulador00000000000 no simulador>
# Central de Bugs — front (vão para o navegador; nada secreto aqui)
VITE_CENTRAL_DE_BUGS_CONEXAO=<o mesmo codigo>
VITE_CENTRAL_DE_BUGS_URL=https://app.stgcompany.com.br
```

Acrescente os tipos em `vite-env.d.ts`, dentro de `ImportMetaEnv`:
`readonly VITE_CENTRAL_DE_BUGS_CONEXAO?: string` e `readonly VITE_CENTRAL_DE_BUGS_URL?: string`.

## Passo 8 — Servidor: registrar o plugin do token

Registre o plugin **depois** da autenticação do SaaS, no mesmo contexto das rotas que leem a
sessão:

```ts
import centralDeBugs from '@stg/central-de-bugs-fastify'

await app.register(centralDeBugs, {
  // O getter de sessão que o SaaS JÁ usa. null → 401: sem usuário, sem relato.
  usuario: async (req) => {
    const sessao = await <o getter do SaaS>(req)
    if (!sessao) return null
    return { id: sessao.usuario.id, nome: sessao.usuario.nome, email: sessao.usuario.email }
  },
})
```

- A rota é `GET /api/central-de-bugs/token` e responde `text/plain` com o JWT. Se o plugin
  ficar dentro de um contexto com `prefix`, o caminho ganha o prefixo. Nesse caso, ou passe
  `rota` ou ajuste a função `token` do front.
- `id` vira o `sub` do token, a identidade da pessoa em "Meus relatos". Use o id **estável**
  do usuário, nunca o e-mail. Se o mesmo id puder se repetir entre clientes, use
  `` `${tenantId}:${userId}` ``. O limite é de 128 caracteres.
- `email` é opcional. Só serve para o aviso por e-mail, que vem desligado por padrão na
  conexão. Pergunte ao dev se quer mandar.
- Sem chave ou sem conexão no ambiente, o plugin **não derruba** o SaaS. Ele loga o erro no
  boot e a rota passa a responder 503. Por isso, confira o log do servidor depois de subir.
- Opções: `chavePrivada` e `conexao` (padrão: as variáveis de ambiente), `rota` (padrão
  `/api/central-de-bugs/token`) e `duracaoS` (padrão 600, máximo 900).

Mostre o diff ao dev antes de aplicar.

## Passo 9 — Front: montar o widget

Na raiz **autenticada** (Passo 1):

```tsx
import { CentralDeBugs } from '@stg/central-de-bugs'

const CONEXAO = import.meta.env.VITE_CENTRAL_DE_BUGS_CONEXAO
const CENTRAL = import.meta.env.VITE_CENTRAL_DE_BUGS_URL

{CONEXAO && CENTRAL && (
  <CentralDeBugs
    conexao={CONEXAO}
    central={CENTRAL}
    token={async () => {
      // O MESMO caminho autenticado que o SaaS já usa (proxy, credentials, cliente próprio).
      const r = await fetch('/api/central-de-bugs/token', { credentials: 'include' })
      if (!r.ok) throw new Error(`token da Central de Bugs: ${r.status}`)
      return r.text()
    }}
    versao={import.meta.env.VITE_VERSAO /* se o SaaS tiver um SHA/versão do build */}
    contexto={/* Passo 10 */}
  />
)}
```

Props disponíveis: `conexao`, `central`, `token` (obrigatórias), `contexto`, `perguntas`,
`versao`, `tela`, `raizDoPrint`, `posicao` (`'direita' | 'esquerda'`), `textos` e `tema`.
As duas são **funções**, não valores: o widget as chama na hora do relato, para pegar a tela
daquele momento.

- `tela?: () => string`: use se o SaaS tiver um título de tela melhor que o `document.title`.
  Nunca escreva `tela="Pedidos › #812"` nem `tela={titulo}`. O TypeScript recusa (TS2322), e
  num projeto sem typecheck o widget falha ao chamar um texto como função.
- `raizDoPrint?: () => HTMLElement | null`: use se o conteúdo rola dentro de um container, e
  não no `body`. Se a função devolver `null`, o print usa o `body`. Passe o tipo ao
  `querySelector` (`<HTMLElement>`): sem ele, o retorno é `Element | null`, e o TypeScript
  recusa.

```tsx
<CentralDeBugs
  /* …as props obrigatórias acima… */
  tela={() => (pedido ? `Pedidos › #${pedido.id}` : 'Pedidos')}
  raizDoPrint={() => document.querySelector<HTMLElement>('main')}
/>
``` Para abrir a Central de um menu de ajuda do SaaS, use
`abrirCentralDeBugs('bug')` ou `abrirCentralDeBugs('sugestao', 'meus')`, que são exportados
pelo mesmo pacote.

Mostre o diff ao dev antes de aplicar.

## Passo 10 — Propor `contexto()`, `registrar()` e perguntas (o dev aprova)

Leia o código para achar onde ficam **o cliente/tenant**, **o usuário**, **o plano** e **as
entidades da tela atual**: contexts do React, stores (zustand, redux), cache do react-query e
params da rota. Proponha:

**`contexto()`**: lido no momento do relato e nunca perguntado à pessoa. Regras do contrato:

- chave em `snake_case` (`^[a-z][a-z0-9_]{0,39}$`), no máximo 20 itens;
- valor primitivo (texto até 500, número, booleano, `null`) ou
  `{ valor, rotulo?, id?, sensivel? }`;
- marque `sensivel: true` em CPF, CNPJ de pessoa física, telefone, endereço, e-mail de cliente
  final e dado de pagamento. O valor sensível **não entra na descrição da tarefa**: fica só na
  ficha do relato, para quem já lê a tarefa;
- **nunca** coloque token, senha, chave de API ou cookie;
- tem de ser barato e síncrono, e não pode lançar erro. Leia o que já está em memória.

Exemplo para o **Acelera Catálogo**:

```tsx
contexto={() => ({
  lojista: { valor: lojista.nome, id: lojista.id },
  plano: lojista.plano,
  catalogo_ativo: catalogo ? { valor: catalogo.nome, id: catalogo.id } : null,
  canal_de_venda: canalSelecionado ?? null,            // 'mercado_livre', 'shopee', …
  produto_aberto: produto ? { valor: produto.titulo, id: produto.sku } : null,
  cnpj_do_lojista: { valor: lojista.cnpj, sensivel: true },
})}
```

**`registrar(nome, detalhes)`**: os últimos 30 eventos do domínio, que entram em "Últimos
eventos" do relato de **bug**. Proponha 3 a 6 pontos nos fluxos críticos, logo depois do
sucesso ou da falha. Os detalhes são planos, com até 10 chaves e sem dado pessoal. Exemplo para
o Acelera Catálogo:

```ts
import { registrar } from '@stg/central-de-bugs'

registrar('catalogo trocado', { catalogo_id: catalogo.id, canal: catalogo.canal })
registrar('produto publicado', { produto_id: produto.id, canal: 'mercado_livre', variacoes: produto.variacoes.length })
registrar('publicacao falhou', { produto_id: produto.id, canal: 'shopee', motivo: erro.code ?? 'desconhecido' })
registrar('importacao concluida', { arquivo_linhas: linhas, erros: falhas })
```

**`perguntas`**, opcional e com parcimônia: no máximo 1 ou 2, e só se a resposta não puder ser
lida do código. Formato:
`{ chave, rotulo, tipo: 'texto' | 'opcao' | 'numero' | 'sim_nao', opcoes?, obrigatoria?, so_em?: 'bug' | 'sugestao', ajuda? }`.

Em `tipo: 'opcao'`, cada item de `opcoes` é texto (`'Matriz'`) ou
`{ valor, rotulo?, icone?, descricao? }` (pacotes 0.2.0+). O que vai gravado é sempre o
`valor` (texto, único); `rotulo` é o que a pessoa lê; `icone` é um nó React; `descricao` é uma
linha menor no seletor. Até 6 opções viram pílulas, mais que isso um seletor com busca (a
partir de 9). Quando o SaaS já usa um pacote de ícones (veja o `package.json` do front:
`lucide-react`, `@heroicons/react`…), proponha ícones **desse** pacote, ~15px, sem cor fixa
(o widget pinta com `currentColor`). Nunca instale um pacote de ícones só para isso; sem um,
deixe as opções sem ícone. Exemplo com lucide-react:

```tsx
import { Bike, Store, Truck } from 'lucide-react'

perguntas={[{
  chave: 'entrega',
  rotulo: 'Como o pedido chega ao cliente?',
  tipo: 'opcao',
  so_em: 'bug',
  opcoes: [
    { valor: 'transportadora', rotulo: 'Transportadora', icone: <Truck size={15} />, descricao: 'Correios ou frete contratado' },
    { valor: 'motoboy', rotulo: 'Motoboy', icone: <Bike size={15} /> },
    { valor: 'retirada', rotulo: 'Retirada na loja', icone: <Store size={15} /> },
  ],
}]}
```

Use `valor` estável em `snake_case` (é o que aparece na tarefa e no que a triagem lê) e deixe o
texto bonito para o `rotulo`.

Mostre tudo junto ao dev (o diff de cada arquivo) e pergunte com AskUserQuestion: "Aplicar como
está", "Aplicar sem as perguntas extras" ou "Quero ajustar". Aplique só o que ele aprovar.

## Passo 11 — Telas sensíveis: `data-relato-ignorar`

O print automático sai do SaaS para a Central. Procure telas e componentes com dado sensível:
`grep -ril` por `cpf`, `cnpj`, `cartao`, `card`, `pix`, `iban`, `senha`, `password`, `token`,
`salario`, `saldo`, `extrato`, `telefone`, `endereco` e `nascimento` nos componentes do front.
Para cada achado, proponha `data-relato-ignorar` no **menor container** que tem o dado (o
painel, o card, a tabela), e não na página inteira. O elemento com esse atributo nunca aparece
no print. A pessoa ainda pode tarjar o print no editor de marcação antes de enviar.

Liste as propostas para o dev (arquivo, elemento, por quê) e aplique as que ele aprovar.

## Passo 12 — Testar no simulador

1. Garanta os valores do simulador no `.env` local (Passo 7).
2. Suba o simulador **em segundo plano**:
   `npx central-de-bugs simular --env <arquivo .env do servidor> --nome "<nome do SaaS>"`.
   Ele mostra `http://localhost:4545` e o painel em `/painel`. Se a porta estiver ocupada, use
   `--porta` e ajuste o `VITE_CENTRAL_DE_BUGS_URL`.
3. Suba o servidor e o front do SaaS com os scripts de dev dele, também em segundo plano.
   Confira que o servidor não logou erro da Central de Bugs no boot.
4. Relate um bug de teste:
   - **Com Playwright no repositório:**
     `node "${CLAUDE_SKILL_DIR}/relatar-teste.mjs" --url http://localhost:<porta do Vite> --de <pasta com o playwright>`.
     O script abre um navegador visível. Avise o dev para **fazer login nele**. Depois disso, o
     script abre o widget, preenche e envia o bug, e imprime o relato que o simulador recebeu.
     Se os testes e2e do SaaS já salvam uma sessão logada (`storageState`, por exemplo
     `playwright/.auth/user.json`), acrescente `--estado <arquivo> --sem-janela`, e nesse caso
     ninguém precisa clicar. Prefira em `--url` o link direto de uma tela com entidade aberta
     (por exemplo `http://localhost:5173/catalogos/12/produtos/812`). Assim o `contexto()`
     tem o que mostrar. Os `registrar()` só aparecem se algum fluxo rodou. Para vê-los, peça
     ao dev um relato à mão (opção abaixo) depois de usar a tela.
   - **Sem Playwright:** peça ao dev para abrir o SaaS, clicar em "Bug ou sugestão", relatar um
     bug qualquer e avisar. Depois leia `curl -s http://localhost:4545/painel/api/relatos`
     (o mais recente vem primeiro).
5. **Mostre ao dev a `descricao` gerada**: é exatamente o texto que a tarefa terá na Central.
   Confira com ele que:
   - "Quem" diz "usuário do <nome do SaaS>";
   - o bloco **Contexto do <SaaS>** tem os itens do `contexto()`, e os sensíveis aparecem como
     `🔒 sensível — ver no relato`;
   - **Últimos eventos** mostra os `registrar()` que rodaram;
   - o print está nos anexos e não mostra nada que deveria estar ignorado.
6. Para ver a volta para quem relatou, mude o status e mande uma pergunta pelo painel
   (`http://localhost:4545/painel`). O botão do widget ganha um ponto, e "Meus relatos" mostra o
   status e a conversa.
7. Pare os processos que você subiu.

Se o botão não aparecer, olhe nesta ordem: o log do servidor (rota do token 401/503), o console
do navegador (avisos `[central-de-bugs]`) e as variáveis `VITE_` (o Vite só as lê ao subir).

## Passo 13 — Conferir a conexão real

Com o `codigo` da instalação, rode:

```
npx central-de-bugs verificar --central https://app.stgcompany.com.br --conexao <codigo> --env <arquivo> --origem <origem de produção>
```

O comando assina um token com a chave local e chama a Central de verdade. Ele confirma que a
pública cadastrada é a desta chave, que a conexão está em modo teste e que a origem de produção
está liberada no CORS. Se falhar, ele explica o motivo (401 = chave, 404 = código, 410 =
desligada, 403 = origem).

## Passo 14 — O que fica com o dev (lista final)

Termine com esta lista, preenchida com os valores reais:

1. **Coolify, aplicação do SaaS:**
   - servidor (runtime): `CENTRAL_DE_BUGS_CHAVE_PRIVADA` e `CENTRAL_DE_BUGS_CONEXAO=<codigo>`.
     O dev copia o valor da chave privada **do próprio `.env`, pelo editor dele**, direto para o
     painel do Coolify. Nunca pela conversa.
   - front (**variável de build**, porque o Vite embute no build):
     `VITE_CENTRAL_DE_BUGS_CONEXAO=<codigo>` e
     `VITE_CENTRAL_DE_BUGS_URL=https://app.stgcompany.com.br`.
   - nada para os pacotes: o `npm ci` do build baixa os `.tgz` pelas URLs públicas que estão
     no lock, sem token.
2. **Commit** do código, do `package.json` e do lock, do `.env.example` e do `.gitignore`. O
   `.env` nunca entra.
3. **Deploy.**
4. **Um relato real em produção**, ainda em modo teste. Nada vira tarefa: a confirmação do
   widget mostra a descrição, e a tela da conexão na Central lista os últimos testes.
5. **Sair do modo teste**: pedir ao agente "sai do modo teste da Central de Bugs" (seção
   abaixo) ou desligar na tela da conexão. A partir daí os relatos viram tarefas, e
   `localhost` deixa de ser aceito pela Central real.

## Sair do modo teste

1. Descubra o `codigo` da conexão (`CENTRAL_DE_BUGS_CONEXAO` no `.env.example` ou nas variáveis
   do deploy; se não achar, use `pastas_para_central_de_bugs`, que mostra a conexão de cada
   pasta).
2. Chame **`sair_do_modo_teste`** com `{ "conexao": "<codigo>", "dry_run": true }` e mostre ao
   dev o que muda: a partir dali, cada relato vira tarefa na lista e o responsável é avisado.
3. Confirmado, repita sem `dry_run`.
4. Lembre o dev de que o widget local (`http://localhost`) deixa de funcionar contra a Central
   real. Em desenvolvimento, ele passa a usar o simulador.

Para alterar a conexão de outras formas (trocar chave, origens ou responsável, ou desligar),
o caminho é a tela da conexão na Central. O MCP não faz isso.
