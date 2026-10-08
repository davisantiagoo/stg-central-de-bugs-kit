---
name: instalar-central-de-bugs
description: Instala a Central de Bugs da STG no SaaS deste repositório (React + Vite no front, Fastify no servidor), do começo à publicação, em 7 etapas guiadas. Entende o projeto, decide com o dev o que capturar no momento do bug além do básico, cria as listas Bugs e Melhorias numa pasta da Central pelo MCP, gera as chaves, implementa widget e plugin com o visual do SaaS (cores, cantos, modo escuro, contraste conferido), prepara as variáveis de ambiente locais e de produção, testa no simulador, publica e confere em produção até sair do modo teste. Use quando pedirem para "instalar a Central de Bugs", "ligar este SaaS à Central de Bugs", "pôr o botão de bug" ou "sair do modo teste" da Central de Bugs.
argument-hint: "[nome do SaaS]"
---

# Instalar a Central de Bugs neste SaaS

Você vai guiar o dev pela instalação da Central de Bugs da STG no SaaS deste repositório, do
primeiro arquivo lido até o primeiro relato real em produção. Os relatos de quem usa o SaaS
viram tarefas nas listas **Bugs** e **Melhorias** de uma pasta da Central
(`https://app.stgcompany.com.br`). O MCP da Central é o servidor `central-de-bugs` deste plugin
(no `/mcp`: `plugin:central-de-bugs:central-de-bugs`).

A instalação é uma **conversa guiada**, não um script mudo. Em cada etapa o dev sabe onde está,
o que você vai fazer e o que precisa dele. Nada muda no código, na Central ou no ambiente sem ele
ver antes.

Se o pedido for só **sair do modo teste**, pule para a seção "Sair do modo teste" no fim.

Arquivos de apoio, nesta pasta (`${CLAUDE_SKILL_DIR}`). Leia só a seção que a etapa indicar:
- `referencia.md`: pacotes, variáveis, modelos de código e regras de captura;
- `problemas.md`: o que fazer quando algo falha;
- `variaveis-de-producao.mjs`: monta o arquivo de variáveis de produção sem expor a chave;
- `relatar-teste.mjs`: relata um bug de teste pelo widget, no simulador.

## Regras que valem do primeiro ao último passo

1. **A chave privada nunca passa por você.** A CLI a grava direto no `.env`, e o
   `variaveis-de-producao.mjs` a copia para o arquivo de produção. Essas duas peças são as
   únicas que leem a chave, e nenhuma a imprime. Nunca rode `cat`, `grep`, `sed`, `head` ou
   `Read` num arquivo que tenha `CENTRAL_DE_BUGS_CHAVE_PRIVADA`. Isso inclui o `.env`, o
   `.env.local`, o `.env.production` e o `.env.central-de-bugs.producao`. Para saber se a chave
   existe, use `npx central-de-bugs chave-publica --env <arquivo>`, que só imprime a pública. Se
   a privada aparecer na conversa por qualquer motivo, diga ao dev que ela está comprometida e
   gere outra com `npx central-de-bugs chaves --env <arquivo> --forcar`.
2. **Recuse `VITE_` na chave privada.** Tudo que começa com `VITE_` vai para o navegador.
3. **Nenhum arquivo com segredo vai para o git.** Confira com `git check-ignore` antes de gravar.
4. **Os pacotes não pedem token.** Não crie `.npmrc` nem peça token ou login no npm. Se o dev
   colar um token na conversa, não o repita e recomende revogá-lo.
5. **Escrita na Central só com `dry_run` primeiro.** Vale para `instalar_central_de_bugs` e
   `sair_do_modo_teste`: simule, mostre e só repita sem `dry_run` depois do sim do dev.
6. **Código do SaaS: proponha, mostre e só então aplique.** O dev conhece o domínio, você não.
7. **Nada sai da máquina sem o sim do dev.** Commit, push e deploy só depois de ele aprovar.
8. **Nomes exatos.** Pacotes `@stg/central-de-bugs`, `@stg/central-de-bugs-fastify` e
   `@stg/central-de-bugs-cli` (binário `central-de-bugs`). Variáveis
   `CENTRAL_DE_BUGS_CHAVE_PRIVADA`, `CENTRAL_DE_BUGS_CONEXAO`, `VITE_CENTRAL_DE_BUGS_CONEXAO` e
   `VITE_CENTRAL_DE_BUGS_URL`. Não invente outros.

## Como falar com o dev durante a instalação

**Abra com esta mensagem** (adapte o nome do SaaS; se ainda não souber, diga "este SaaS"):

> Vou instalar a **Central de Bugs** no **<SaaS>**. No fim, quem usa o <SaaS> terá um botão
> "Bug ou sugestão", e cada relato chega como tarefa na Central, com print, contexto do negócio
> e o rastro técnico do que deu errado.
>
> São 7 etapas, e em cada uma eu digo o que vou fazer antes de mexer em qualquer coisa:
>
> 1. **Entender o projeto**: leio o código, sem alterar nada
> 2. **Decidir o que capturar**: o que o relato leva além do básico
> 3. **Conectar à Central**: login, pasta e chaves
> 4. **Implementar**: servidor, widget com o visual do <SaaS> e o plano de captura
> 5. **Variáveis de ambiente**: as locais e as de produção, num arquivo pronto
> 6. **Testar localmente**: um bug de teste num simulador da Central
> 7. **Publicar e testar em produção**: deploy, relato real e ativação
>
> De você eu vou precisar de: login na Central (abre o navegador), algumas escolhas, colar as
> variáveis no painel do deploy e mandar um relato de teste em produção.

Crie um checklist com as 7 etapas (a ferramenta de tarefas, se disponível) e mantenha-o em dia.

**Ao começar cada etapa**, mostre onde o dev está e o que vem:

> **Etapa 3 de 7 · Conectar à Central**
> ✓ Projeto · ✓ Captura · **▸ Conexão** · Implementar · Variáveis · Teste local · Produção
>
> Agora vou: <uma frase>. Vou precisar de você para: <uma frase, ou "nada, só acompanhar">.

**Ao terminar cada etapa**, feche com uma linha do que ficou pronto ("✓ Conectado: listas
criadas na pasta X, código `cdb_…`"). Use AskUserQuestion sempre que a resposta for uma
escolha. Quando algo falhar, consulte `problemas.md` e explique em uma ou duas frases.

---

## Etapa 1 · Entender o projeto

Só leitura. Descubra:

**Stack e estrutura**
- **Gerenciador de pacotes:** `package-lock.json` → npm, `pnpm-lock.yaml` → pnpm,
  `yarn.lock` → yarn. Em monorepo, quais workspaces são o front e o servidor.
- **Front:** o pacote com `vite` e `react`. O `vite.config.*`, a porta (`server.port`, padrão
  5173), `envDir`, `envPrefix` e o `vite-env.d.ts`.
- **Raiz autenticada:** o componente que só renderiza com alguém logado (layout de rotas
  protegidas, `<RequireAuth>`, `if (!session) return <Login/>`, provider de sessão). O widget
  vai lá.
- **Como o front chama a API:** `fetch('/api/…')` com proxy do Vite, outra origem com
  `credentials: 'include'` ou um cliente próprio (`api.get`, axios, ky).
- **Servidor:** o pacote com `fastify`. Onde o app é montado, onde a autenticação é registrada,
  **como uma rota lê o usuário logado** (`req.user`, `req.session.user`,
  `auth.api.getSession({ headers })`, `getUsuario(req)`…) e o prefixo das rotas de API.
- **Onde o servidor lê o `.env`** (`dotenv`, `--env-file`, `@fastify/env`) e **qual arquivo**.
  Anote se ele existe; **não o leia** (regra 1).
- **Deploy:** procure `Dockerfile`, `nixpacks.toml`, `docker-compose*`, `vercel.json`,
  `.github/workflows`. Anote se front e servidor saem num deploy só ou em dois, e se o push na
  branch principal já dispara o deploy.
- **Origens:** desenvolvimento (`http://localhost:<porta do Vite>`) e produção (`https://…`).
  Procure em `.env.example`, README, CORS e arquivos de deploy. Se a origem só estiver num
  `VITE_*_URL` de um `.env` real, imprima só aquela linha:
  `node -e "for (const l of require('fs').readFileSync(process.argv[1],'utf8').split('\\n')) if (/^VITE_[A-Z0-9_]*URL=/.test(l)) console.log(l)" <arquivo>`.
- **Playwright:** se `playwright` ou `@playwright/test` está nas dependências.
- **Visual:** de onde vêm as cores, o raio e a fonte do SaaS. Procure, nesta ordem: variáveis
  CSS no `:root` (shadcn: `--primary`, `--card`, `--radius`; Chakra: `--chakra-colors-*`), o
  `tailwind.config.*` ou o `@theme` do Tailwind 4, um tema de MUI/Chakra/Mantine em JS e a
  fonte carregada no `index.html` ou no CSS global. Veja também **como o modo escuro liga**:
  uma classe no `<html>` (qual?), um atributo (`data-theme`), um estado em JS, só o sistema, ou
  nenhum. E se há algo flutuante no canto inferior direito (chat, botão de ajuda).
- **Já instalado?** `@stg/central-de-bugs` no `package.json` ou `CENTRAL_DE_BUGS_` no
  `.env.example`. Se sim, diga ao dev e pergunte o que ele quer refazer, em vez de duplicar.

**Escopo do produto**: o que torna um relato útil depende disso.
- **Nome e propósito:** `$ARGUMENTS`, `package.json`, README, `<title>`.
- **Entidades principais:** o que o produto manipula (pedidos, catálogos, clientes, contratos…).
  Olhe as rotas do front, os módulos do servidor e o schema do banco.
- **Fluxos críticos:** onde um erro custa caro (publicar, pagar, importar, integrar com
  terceiros, enviar). Eles serão os `registrar()`.
- **Multi-tenant?** Se há cliente/organização/loja acima do usuário, isso entra no contexto.
- **Dado sensível na tela:** CPF, cartão, saldos, contatos de cliente final.

**Trava de segurança.** Se o `vite.config` tiver um `envPrefix` que case com
`CENTRAL_DE_BUGS_CHAVE_PRIVADA` (por exemplo `'CENTRAL_'`) ou um `define` que injete
`process.env` inteiro, **pare**: a chave iria para o navegador. Proponha a correção antes de
seguir.

**Feche a etapa com o retrato do projeto:**

> **O que eu entendi do <SaaS>**
> - **Produto:** <uma frase>
> - **Stack:** <front> · <servidor> · <gerenciador> · <monorepo ou não>
> - **Entidades:** <3 a 5>
> - **Fluxos críticos:** <3 a 5>
> - **Login:** raiz autenticada em `<arquivo>`, usuário lido por `<getter>`
> - **Variáveis:** servidor lê `<arquivo .env>` (<existe | será criado>)
> - **Deploy:** <onde e como; um ou dois deploys; push dispara ou não>
> - **Origens:** <dev> e <produção>
> - **Visual:** <de onde vêm as cores> · modo escuro <por classe X | por estado | só sistema | não tem>

Se algo ficou em dúvida, pergunte agora, numa AskUserQuestion só.

## Etapa 2 · Decidir o que capturar

Ainda sem alterar nada. O objetivo é que quem for corrigir o bug entenda o que aconteceu **sem
precisar perguntar a quem relatou**. Leia `referencia.md` §E.

1. **Explique o básico** em duas linhas: o widget já leva, sozinho, o print da tela, a tela e a
   URL, navegador e sistema, os erros de console, as requisições que falharam e as últimas
   navegações. Isso não precisa de código.
2. **Monte o plano de captura**, com base no retrato da Etapa 1, procurando no código onde cada
   dado já está em memória (contexts, stores, cache do react-query, params da rota):

   > **Plano de captura do <SaaS>**
   >
   > **Contexto no momento do relato** (lido do app, a pessoa não digita nada)
   > | Item | De onde vem | Por que ajuda |
   > | --- | --- | --- |
   > | `lojista` | `useLojista()` | saber de qual cliente é o problema |
   > | `catalogo_ativo` | param `:catalogoId` | reproduzir no mesmo catálogo |
   > | `cnpj_do_lojista` 🔒 | `useLojista()` | sensível: fica fora da descrição da tarefa |
   >
   > **Eventos antes do bug** (o rastro do que a pessoa fez)
   > | Evento | Onde entra | Por que ajuda |
   > | --- | --- | --- |
   > | `produto publicado` / `publicacao falhou` | `publicarProduto()` | ver a falha que antecedeu o relato |
   >
   > **Perguntas extras** (só se o código não souber; no máximo 2): <nenhuma | quais>
   >
   > **Fora do print** (`data-relato-ignorar`): <componentes com dado sensível>

3. Pergunte com AskUserQuestion: **"Aprovar o plano"**, **"Quero ajustar"** ou **"Só o básico
   por enquanto"**. No ajuste, refaça só o que ele pediu. O plano aprovado é aplicado na Etapa 4.

## Etapa 3 · Conectar à Central

1. **Instalar os pacotes** (`referencia.md` §A). Os três agora: a CLI gera as chaves logo
   abaixo. Confira com `npx central-de-bugs --ajuda`. Se falhar: `problemas.md` §1.
2. **Login e pastas.** Avise: "vai abrir o navegador para você entrar na Central e autorizar".
   Chame **`pastas_para_central_de_bugs`**. Se a ferramenta não existir ou o login falhar:
   `problemas.md` §2. Para ler a resposta e tratar pasta que já tem conexão: `problemas.md` §3 e §4.
3. **Escolhas do dev**, numa AskUserQuestion só:
   - **Pasta:** "Em qual pasta da Central ficam os bugs do <SaaS>?". Até 4 pastas com
     `podeInstalar: true`, primeiro as que têm o nome do SaaS, com o `caminho` como rótulo.
   - **Responsável:** "Quem recebe os relatos novos?": "Eu mesmo" ou "Outra pessoa" (nome ou
     e-mail; precisa editar a pasta).
   - **Nome do SaaS** nas tarefas ("usuário do <nome>"), com o que você achou como primeira opção.
   - **Origens** (multiSelect): produção `https://…` e `http://localhost:<porta>`. Explique que
     `localhost` só vale enquanto a conexão está em modo teste.
4. **Chaves.** Confirme que o `.env` do servidor está ignorado:
   `git check-ignore -q <arquivo> && echo ignorado`.
   - Não ignorado: mostre a linha que vai acrescentar ao `.gitignore` e aplique.
   - Versionado (`git ls-files --error-unmatch <arquivo>` acha): **pare**. Ele precisa sair do
     git (`git rm --cached`, um commit) antes, e os segredos que já estão nele devem ser
     considerados expostos.

   Depois: `npx central-de-bugs chaves --env <arquivo>`. Se o arquivo não existir, a CLI o
   cria (permissão 600). O stdout é uma linha só, a JWK **pública**. Se responder que já há
   chave, não troque: use `npx central-de-bugs chave-publica --env <arquivo>`.
   Diga ao dev: "a chave privada foi gravada no `<arquivo>` e não passou por mim. A pública é a
   que vai para a Central."
5. **Criar as listas e a conexão.** Chame **`instalar_central_de_bugs`** com `dry_run: true`:

   ```json
   {
     "pasta": "<id da pasta>",
     "nome_saas": "<nome>",
     "origens": ["https://app.exemplo.com.br", "http://localhost:5173"],
     "responsavel": "<omita para o próprio dev, ou nome/e-mail>",
     "chave_publica": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…", "kid": "…" },
     "dry_run": true
   }
   ```

   Mostre o que a simulação descreveu (pasta, listas e status, responsável, origens, modo teste
   ligado) e pergunte: "Criar agora" ou "Ajustar algo". Confirmado, repita **sem** `dry_run`.
   Guarde o `codigo` (`cdb_…`, público) e mostre os links das listas. Erros: `problemas.md` §5.

## Etapa 4 · Implementar

Prepare tudo e mostre de uma vez, arquivo por arquivo, com o diff:

1. **Servidor:** registrar o plugin do token com o getter de sessão da Etapa 1 (`referencia.md` §C).
2. **Front:** montar `<CentralDeBugs>` na raiz autenticada, com a função `token` usando o mesmo
   caminho autenticado que o SaaS já usa (`referencia.md` §D).
3. **Plano de captura aprovado na Etapa 2:** `contexto()`, os `registrar()` nos fluxos,
   `perguntas` e `data-relato-ignorar` (`referencia.md` §E).
4. **O visual do <SaaS>** (`referencia.md` §F). Monte o `tema` a partir do que a Etapa 1 achou,
   de preferência **apontando para as variáveis do SaaS** (`hsl(var(--primary))`), para o widget
   acompanhar o modo escuro e futuras trocas de marca. Mapeie todas as cores, não só o acento.
   Ligue o `esquema` ao modo escuro do SaaS, se houver. Se algo ocupa o canto direito, proponha
   `posicao: 'esquerda'`. Mostre ao dev a tabela "cor do <SaaS> → parte do widget":

   > | Parte do widget | Vem do <SaaS> |
   > | --- | --- |
   > | botão principal e foco | `--primary` (verde da marca) |
   > | fundo do formulário | `--card` |
   > | cantos | `--radius` (8px) |
   > | modo escuro | acompanha a classe `dark` do `<html>` |

   O contraste é medido na Etapa 6, com as cores de verdade.

Pergunte: **"Aplicar tudo"**, **"Revisar arquivo por arquivo"** ou **"Quero ajustar"**. Aplique
só o aprovado. Se o projeto tiver typecheck ou lint, rode-os nos arquivos tocados e corrija o que
for seu.

## Etapa 5 · Variáveis de ambiente

Comece explicando a tabela das quatro variáveis (`referencia.md` §B): o que é cada uma, qual é
secreta, o valor local e o de produção.

1. **Local (desenvolvimento, apontando para o simulador):**
   - no `.env` do servidor: `CENTRAL_DE_BUGS_CONEXAO=cdb_simulador00000000000`. A chave privada
     já está lá desde a Etapa 3;
   - no `.env` do front (o `envDir` do Vite; num pacote só, o mesmo arquivo):
     `VITE_CENTRAL_DE_BUGS_CONEXAO=cdb_simulador00000000000` e
     `VITE_CENTRAL_DE_BUGS_URL=http://localhost:4545`.

   Se o arquivo do front não existir, crie e confira que está ignorado. Grave linha a linha,
   **sem ler o arquivo** (o comando está em `referencia.md` §B).
2. **Para o repositório:** acrescente as quatro ao `.env.example` (crie se não existir) e os
   tipos ao `vite-env.d.ts` (`referencia.md` §B).
3. **Produção, num arquivo pronto para colar.** Acrescente `.env.central-de-bugs.producao` ao
   `.gitignore` (mostre a linha) e rode:

   ```bash
   node "${CLAUDE_SKILL_DIR}/variaveis-de-producao.mjs" --env <.env do servidor> --conexao <codigo>
   ```

   O script grava o arquivo ao lado do `.env` do servidor (permissão 600, fora do git) com as
   quatro variáveis de produção, a chave privada de verdade incluída, e imprime a tabela com a
   chave mascarada. Mostre ao dev a tabela que ele imprimiu e diga:

   > ✓ As variáveis de produção estão prontas em `<arquivo>`. **Você vai colá-las no painel do
   > deploy na Etapa 7**, logo antes de publicar. Eu aviso na hora.

Feche a etapa listando o que ficou onde: o `.env` local (simulador), o `.env.example`, os tipos
e o arquivo de produção.

## Etapa 6 · Testar localmente

1. Suba o simulador **em segundo plano**:
   `npx central-de-bugs simular --env <.env do servidor> --nome "<nome do SaaS>"`.
   Ele responde em `http://localhost:4545`, com painel em `/painel`. Porta ocupada: `--porta` e
   ajuste o `VITE_CENTRAL_DE_BUGS_URL`.
2. Suba servidor e front com os scripts de dev do SaaS, também em segundo plano. Confira que o
   servidor não logou erro da Central de Bugs no boot.
3. Relate um bug de teste:
   - **Com Playwright:**
     `node "${CLAUDE_SKILL_DIR}/relatar-teste.mjs" --url http://localhost:<porta> --de <pasta com o playwright>`.
     Abre um navegador visível: avise o dev para **fazer login nele**. O script abre o widget,
     envia e imprime o relato. Com sessão salva pelos testes e2e (`storageState`), acrescente
     `--estado <arquivo> --sem-janela`. Prefira em `--url` uma tela com entidade aberta, para o
     `contexto()` ter o que mostrar.
   - **Sem Playwright:** peça ao dev para abrir o SaaS, clicar em "Bug ou sugestão", relatar e
     avisar. Leia `curl -s http://localhost:4545/painel/api/relatos` (o mais recente primeiro).
4. **Mostre a `descricao` gerada**, que é exatamente o texto da tarefa na Central, e confira com
   o dev: "Quem" diz "usuário do <SaaS>"; o **Contexto** tem os itens do plano, com os sensíveis
   como `🔒 sensível — ver no relato`; **Últimos eventos** mostra os `registrar()` que rodaram; o
   print não mostra nada que deveria estar ignorado.
5. **Confira o visual.** Com Playwright, rode o mesmo script com `--visual`, sem enviar outro
   relato:
   `node "${CLAUDE_SKILL_DIR}/relatar-teste.mjs" --url http://localhost:<porta> --de <pasta com o playwright> --visual <pasta temporária> --so-visual`,
   com `--classe-escuro <classe>` se o modo escuro do SaaS liga por classe no `<html>`. Ele grava
   prints do formulário aberto (nos dois esquemas, com `--classe-escuro`) e do botão, e mede o
   contraste dos pares de cor (sai com código 1 se algum ficar abaixo do mínimo). **Abra os
   prints e mostre ao dev**, junto com a tabela de contraste. Par reprovado: ajuste só aquele no
   `tema` (`referencia.md` §F, "Contraste") e meça de novo. Sem Playwright, peça ao dev para
   abrir o widget nos dois temas do SaaS e dizer se combina.
   Pergunte: **"Ficou com a cara do <SaaS>"** ou **"Quero ajustar"**.
6. Opcional: mude o status e mande uma pergunta pelo painel. O botão ganha um ponto, e "Meus
   relatos" mostra a conversa.
7. Pare os processos que você subiu e apague a pasta dos prints. Botão não apareceu:
   `problemas.md` §7.

## Etapa 7 · Publicar e testar em produção

Anuncie a etapa com o roteiro dela:

> Faltam 5 passos para o <SaaS> relatar em produção: (1) conferir a conexão real, (2) você colar
> as variáveis no painel do deploy, (3) publicar, (4) eu conferir o deploy e (5) você mandar um
> relato de teste. Aí ligamos de vez.

**7.1 Conferir a conexão real**

```bash
npx central-de-bugs verificar --central https://app.stgcompany.com.br --conexao <codigo> --env <.env do servidor> --origem <origem de produção>
```

Confirma chave, código, modo teste e CORS da origem de produção. Falhou: `problemas.md` §6.

**7.2 Variáveis no ambiente de produção.** Este é o momento. Rode o script de novo com `--copiar`
(ele regrava o arquivo e põe o conteúdo na área de transferência):

```bash
node "${CLAUDE_SKILL_DIR}/variaveis-de-producao.mjs" --env <.env do servidor> --conexao <codigo> --copiar
```

Mostre a tabela que ele imprimiu e dê a instrução em destaque, adaptada ao deploy da Etapa 1:

> ### ⚠️ Antes de publicar: cole as variáveis de produção
>
> Sem elas, o botão não aparece em produção. O conteúdo já está na sua área de transferência
> (se não estiver, abra `<arquivo>` no editor e copie tudo).
>
> **Coolify:** aplicação do SaaS → *Environment Variables* → *Developer view* → cole no fim →
> *Save*. Marque as duas `VITE_` como *Build Variable*.
> **Vercel / outros:** cole em *Environment Variables* (a maioria aceita colar um `.env`
> inteiro), com as `VITE_` disponíveis no build.
> **Front e servidor em deploys separados:** as duas primeiras vão no servidor e as duas `VITE_`
> no front.
>
> A chave privada só vai para o painel. Não cole em chat, issue nem mensagem.

Pergunte com AskUserQuestion: **"Já colei e salvei"**, **"Front e servidor são separados, me
ajude"** ou **"Não tenho acesso ao painel"**. Sem acesso, pare aqui e diga o que pedir a quem
administra o deploy: as quatro variáveis, com o arquivo entregue por um canal seguro.

**7.3 Publicar.** Mostre o que vai no commit (`git status --short`): código, `package.json`,
lock, `.env.example`, `.gitignore` e `vite-env.d.ts`. Confira que nenhum `.env*` com segredo
está na lista (`git check-ignore`). Pergunte: **"Commitar e fazer push para <branch>"**, **"Eu
mesmo faço o commit"** ou **"Ainda não"**. Com o sim, commite com uma mensagem clara
("feat: Central de Bugs (widget, token e contexto)") e faça o push. Se o push não dispara o
deploy (Etapa 1), peça ao dev para disparar. Espere ele avisar que o deploy terminou.

**7.4 Conferir o deploy.** Sem sessão, a rota do token diz se o servidor está configurado:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<origem de produção>/api/central-de-bugs/token
```

**401** é o esperado: plugin no ar e com as variáveis. Qualquer outro código: `problemas.md` §8.
Para confirmar que o front foi construído com as `VITE_`, procure o código da conexão nos
scripts da página inicial:

```bash
curl -s https://<origem de produção>/ | grep -oE 'src="[^"]+\.js"' | sed -E 's/src="([^"]+)"/\1/' \
  | while read -r js; do curl -s "https://<origem de produção>${js}" | grep -q '<codigo>' && echo "✓ código no build: $js"; done
```

Achou: ✓. Não achou não prova nada (o widget pode estar num chunk carregado depois). O relato
do passo seguinte decide.

**7.5 Relato real, ainda em modo teste.** Peça:

> Abra o <SaaS> em produção, entre com seu usuário, clique em **"Bug ou sugestão"** e relate um
> bug qualquer ("teste de instalação"). Como estamos em modo teste, **nada vira tarefa**: o
> widget mostra a descrição que a tarefa teria. A tela da conexão na Central também lista os
> últimos testes.

Pergunte: **"Apareceu a descrição"**, **"O botão não apareceu"** ou **"Deu erro ao enviar"**.
Nos dois últimos casos, `problemas.md` §8.

**7.6 Ligar de vez.** Siga a seção "Sair do modo teste" abaixo (com `dry_run` antes). Depois,
ofereça: "Quer mandar um relato de verdade agora, para ver a tarefa nascer na lista Bugs?
Depois é só concluí-la."

**7.7 Fechamento.** Pergunte se pode apagar o arquivo de produção, agora que as variáveis estão
no painel:
`node "${CLAUDE_SKILL_DIR}/variaveis-de-producao.mjs" --env <.env do servidor> --remover`.
Termine com o resumo:

> ✅ **Central de Bugs instalada no <SaaS>**
> - **Listas:** <links de Bugs e Melhorias> · responsável: <pessoa>
> - **Conexão:** `<codigo>` · modo teste desligado
> - **Captura:** <n> itens de contexto, <n> eventos, <n> perguntas, <n> áreas fora do print
> - **Visual:** cores e cantos do <SaaS>, modo escuro <acompanhando | fixo>, contraste conferido
> - **Variáveis:** local no `<arquivo>` (simulador) e produção no painel do deploy
> - **Desenvolvimento:** `npx central-de-bugs simular` sobe o simulador local
> - **Daqui em diante:** a skill `triar-relatos` organiza o que chega, e `corrigir-relato`
>   corrige um relato a partir da tarefa.

## Sair do modo teste

1. Descubra o `codigo` da conexão (`CENTRAL_DE_BUGS_CONEXAO` no `.env.example` ou nas variáveis
   do deploy; se não achar, `pastas_para_central_de_bugs` mostra a conexão de cada pasta).
2. Confirme que um relato real em produção já foi conferido. Se não foi, proponha a Etapa 7.5
   antes.
3. Chame **`sair_do_modo_teste`** com `{ "conexao": "<codigo>", "dry_run": true }` e mostre o que
   muda: cada relato passa a virar tarefa na lista, e o responsável é avisado.
4. Confirmado, repita sem `dry_run`.
5. Lembre o dev de que `http://localhost` deixa de valer na Central real. Em desenvolvimento,
   use o simulador.

Para alterar a conexão de outras formas (trocar chave, origens ou responsável, ou desligar), o
caminho é a tela da conexão na Central. O MCP não faz isso.
