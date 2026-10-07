# Contrato da API externa da Central de Bugs

Esta é a API que o widget `@stg/central-de-bugs` chama, que o simulador do kit imita
e que a Central atende em `https://app.stgcompany.com.br`. Você não precisa chamá-la à mão: o
widget e o plugin fazem isso. Este documento existe para quem depura, para quem integra fora
do stack e para conferir o que o simulador garante.

A especificação legível por máquina está em [openapi.yaml](openapi.yaml). Os tipos e os schemas
(zod) são os do pacote de contrato, que vai embutido nos pacotes publicados, e a Central usa
**o mesmo código**.

## Visão geral

```
navegador do SaaS ──(1) GET /api/central-de-bugs/token──► servidor do SaaS (plugin Fastify)
                  ◄──────────── JWT ES256 ───────────────
navegador do SaaS ──(2) Authorization: Bearer <JWT>────► Central  /api/externo/<conexao>/…
```

- **Base:** `https://app.stgcompany.com.br/api/externo/{conexao}`, ou
  `http://localhost:4545/api/externo/cdb_simulador00000000000` no simulador.
- **`{conexao}`:** o código público da conexão, `^cdb_[a-z0-9]{20}$`. Ele vai no **caminho**, e
  não num cabeçalho, porque o preflight de CORS não carrega `Authorization`: é pelo caminho que
  a Central sabe, já no `OPTIONS`, quais origens aquela conexão aceita.
- **Envelopes:** sucesso `{ "data": … }`. Erro `{ "error": "mensagem", "code"?: "CODIGO", "issues"?: […] }`.
- **Sem cookie, nunca.** A API ignora a sessão da Central e não aceita `credentials: include`.
  O widget chama com `credentials: 'omit'`.

## Rotas

| Método e caminho | O que faz | Sucesso |
| --- | --- | --- |
| `GET /estado` | nome da conexão, tipos aceitos, modo teste, tetos de anexo | 200 `EstadoExterno` |
| `POST /relatos` | cria o rascunho (id gerado pelo cliente, idempotente) | 201 (novo) ou 200 (repetido) `RelatoResumo` |
| `PUT /relatos/{id}/anexos/{anexoId}` | sobe um arquivo cru do rascunho (ou de uma resposta) | 201 (novo) ou 200 (repetido) `Anexo` |
| `POST /relatos/{id}/enviar` | envia: vira tarefa (ou, em modo teste, só devolve a descrição) | 201 (agora) ou 200 (já enviado) `EnvioExterno` |
| `GET /relatos/meus` | "Meus relatos" da pessoa do token: 50 mais recentes, só enviados | 200 `MeuRelatoExterno[]` |
| `GET /relatos/{id}/conversa` | as perguntas da equipe e as respostas da pessoa | 200 `ConversaExterna` |
| `POST /relatos/{id}/respostas` | responde a uma pergunta | 201 (nova) ou 200 (repetida) `ConversaExterna` |
| `OPTIONS /…` | preflight de CORS | 204 |

O fluxo do widget é rascunho → anexos → enviar. O rascunho guarda o texto e o contexto. Cada
anexo sobe sozinho, com progresso. O envio cria a tarefa numa transação só, com os anexos já
ligados. Rascunho não enviado é apagado em 24h, e relato de modo teste em 7 dias.

### Ordem das verificações (todas as rotas)

1. **Conexão:** código fora do formato ou desconhecido → **404** `CONEXAO_NAO_ENCONTRADA`.
   Essa resposta não leva cabeçalho CORS, porque sem conexão não há origens para conferir. No
   navegador ela aparece como erro de CORS.
2. **Origem** (se houver `Origin`): fora das origens da conexão → **403**
   `ORIGEM_NAO_PERMITIDA`, sem cabeçalho CORS, inclusive no preflight. Sem `Origin` (servidor a
   servidor, curl), a requisição segue e o token continua exigido.
3. **Preflight** (`OPTIONS`) → **204**, mesmo com a conexão desligada. Assim o pedido real
   recebe um 410 legível em vez de um erro de CORS opaco.
4. **Conexão desligada** → **410** `CONEXAO_DESLIGADA`. O widget esconde o botão.
5. **Token** → **401** `TOKEN_INVALIDO` se faltar, se estiver malformado ou vencido, se a
   assinatura não conferir ou se for de outra conexão. O motivo não é detalhado de propósito
   (seria um oráculo para quem tenta forjar). O simulador e `central-de-bugs verificar` dizem
   o motivo.

Tudo isso acontece antes de o corpo ser lido: um upload sem token válido é recusado sem que um
byte seja aceito.

### CORS

Com `Origin` permitido, a resposta leva:

```
Access-Control-Allow-Origin: <a origem, ecoada>
Vary: Origin
Access-Control-Allow-Headers: authorization, content-type, x-file-name, x-file-type
Access-Control-Allow-Methods: GET, POST, PUT
Access-Control-Max-Age: 600
```

Nunca `Access-Control-Allow-Credentials`. A comparação é por **igualdade** com a forma
canônica (`https://host[:porta]`, sem barra final), sem prefixo nem curinga.
`http://localhost:*` e `http://127.0.0.1:*` só passam com a conexão em **modo teste**. O
simulador aceita qualquer `localhost`.

## O token

O backend do SaaS assina um **JWT ES256** com a chave privada dele. O plugin Fastify do kit faz
isso pela rota `GET /api/central-de-bugs/token`.

**Cabeçalho:** `{ "alg": "ES256", "typ": "JWT", "kid": "<kid da chave>" }`. Só `ES256` é aceito:
`none`, `HS256` e qualquer outro dão 401. Com `kid`, a Central usa a chave pública de mesmo
`kid`. Sem `kid`, tenta as vigentes. Uma conexão tem no máximo duas chaves vigentes, durante uma
rotação, e a anterior vale 24h depois da troca.

**Claims:**

| Claim | Regra |
| --- | --- |
| `aud` | o código da conexão (`cdb_…`). Token de outra conexão → 401 |
| `sub` | id da pessoa **no SaaS**, 1 a 128 caracteres. Junto com a conexão, é a identidade em "Meus relatos" |
| `nome` | 1 a 120 caracteres. Aparece na tarefa ("Marina Lopes · usuário do <SaaS>") |
| `email` | opcional, e-mail válido de até 254 caracteres. Só é usado se a conexão tiver o aviso por e-mail ligado |
| `iat`, `exp` | inteiros (segundos). `exp - iat ≤ 900`, `iat ≤ agora + 60`, `exp ≤ agora + 960`, e vencido = `exp ≤ agora - 60` |

O plugin usa 600 s por padrão. O widget guarda o token até 60 s antes do `exp`, e num 401 pede
outro e repete **uma** vez.

**A chave.** É um par P-256 gerado por `npx central-de-bugs chaves`. A **privada** fica só no
servidor do SaaS, na variável `CENTRAL_DE_BUGS_CHAVE_PRIVADA`, como base64url do JSON da JWK
privada (com `kid`), numa linha. A **pública** é cadastrada na conexão como JWK:

```json
{ "kty": "EC", "crv": "P-256", "x": "…", "y": "…", "kid": "3379f69d5831c589", "alg": "ES256", "use": "sig" }
```

A Central recusa JWK com `d`, porque isso é uma chave privada colada por engano
(`CHAVE_PRIVADA_RECUSADA`). Também recusa campos fora desses. O `kid` gerado pela CLI são os 16
primeiros caracteres hex do SHA-256 de `"<x>|<y>"`.

## Corpos

### `POST /relatos` — `RelatoExternoCreate`

Discriminado por `tipo`:

| Campo | Bug | Sugestão |
| --- | --- | --- |
| `id` | uuid gerado pelo cliente. Reenviar o mesmo id é idempotente | idem |
| `tipo` | `"bug"` | `"sugestao"` |
| `principal` | texto de 15 a 5.000 caracteres ("O que aconteceu?") | idem ("Qual é a sua ideia?") |
| `complemento` | até 2.000, opcional | idem |
| `impacto` | `travado` \| `atrapalha` \| `detalhe` | `muito` \| `as_vezes` \| `seria_bom` |
| `frequencia` | `sempre` \| `as_vezes` \| `uma_vez` \| `null`, opcional | — |
| `contexto` | `ContextoExterno` | `ContextoExterno` (o rastro é descartado) |
| `extra` | `ExtraRelato`, opcional | idem (os eventos são descartados) |

**`ContextoExterno`** (coletado pelo widget; chave desconhecida é descartada):

| Campo | Limite |
| --- | --- |
| `url` | até 500. A Central guarda **só o caminho**: query e fragmento saem |
| `tela`, `versao`, `navegador`, `janela`, `fuso` | 160, 64, 200, 40, 64 |
| `online` | booleano |
| `erros[]` | até 20: `{ quando ≤40, mensagem ≤500, fonte? ≤200 }` |
| `requisicoes[]` | até 15: `{ quando ≤40, metodo ≤10, caminho ≤300, status 0..999, erro? ≤300 }` |
| `navegacao[]` | até 15 caminhos de até 300 |

O contexto externo **não tem `area`**. As áreas são da Central e viram tag. Se vier, é
descartado.

### O `extra` (o que o SaaS declara)

```json
{
  "contexto": {
    "lojista": { "valor": "Cravina Motos", "id": 4412 },
    "plano": "pro",
    "cnpj_do_lojista": { "valor": "12.345.678/0001-90", "sensivel": true }
  },
  "respostas": [ { "chave": "canal_afetado", "rotulo": "Em qual canal?", "valor": "Mercado Livre" } ],
  "eventos": [ { "quando": "2026-10-06T14:02:11.000Z", "nome": "produto publicado", "detalhes": { "id": 812, "canal": "mercado_livre" } } ]
}
```

A Central valida o **formato**, não uma lista de chaves. O formato que foge do contrato é
**recusado** (422). O conteúdo longo é **cortado** no teto com `…`, porque um dado de execução
grande não pode derrubar o relato de quem está travado. Texto acima de 10× o teto é recusado.

| Regra | Valor |
| --- | --- |
| Chave (de contexto, de pergunta, de detalhe) | `^[a-z][a-z0-9_]{0,39}$` |
| `contexto` | até **20** chaves. Valor primitivo (texto, número, booleano, `null`) ou `{ valor, rotulo?, id?, sensivel? }` |
| Valor de contexto ou de resposta | texto cortado em **500** |
| `rotulo` de contexto / de pergunta | 80 / 120 |
| `id` de contexto | texto (cortado em 80) ou número |
| `respostas` | até **8**, valor texto, número ou booleano |
| `eventos` | até **30**. `nome` até 80, `quando` até 40, até **10** detalhes planos de até 120 |
| `extra` normalizado inteiro | **8.192 bytes** UTF-8 do JSON. Acima disso caem os eventos **mais antigos**. Se nem sem eventos couber → **422** `EXTRA_GRANDE_DEMAIS` (com `bytes`) |

O rótulo padrão é a chave humanizada (`pedido_aberto` → "Pedido aberto"). O widget ajusta o que
o dev declarou fora do formato (camelCase → snake_case, objeto → texto) com um aviso
`[central-de-bugs]` no console, e nunca deixa um erro de integração recusar o relato de alguém.

**Sensível:** com `sensivel: true` o valor fica em `relatos.extra`, mas **nunca** entra na
descrição da tarefa. Lá aparece `🔒 sensível — ver no relato`. Também não aparece em "Meus
relatos", em e-mail nem no MCP, salvo quando quem já lê a tarefa pede `incluir_sensiveis`.

**Nada do `extra` vira tag, status, responsável ou lista.** É só texto na descrição.

### `PUT /relatos/{id}/anexos/{anexoId}`

- Corpo: os **bytes crus** do arquivo, com `Content-Type: application/octet-stream`.
- Cabeçalhos: `X-File-Name` (nome em `encodeURIComponent`, até 255 caracteres depois de
  decodificado) e `X-File-Type` (o tipo declarado).
- O tipo é decidido pelos **bytes**, não pelo declarado: PNG, JPEG, GIF, WebP, PDF, MP4, WebM e
  texto puro (só se declarado `text/plain` e sem byte nulo).
- Tetos no `/estado` (`limites`): **5** arquivos por relato (10 contando os das respostas),
  **10 MB** por arquivo e o teto de vídeo da Central (50 MB por padrão).
- `anexoId` é um uuid do cliente. Reenviar o mesmo arquivo é idempotente (200).

Resposta: `{ "data": { "id", "nome", "mime", "tamanhoBytes" } }`.

### `POST /relatos/{id}/enviar`

Sem corpo e sem `Content-Type`. A Central valida de novo a conexão e a lista do tipo, cria a
tarefa na lista da **conexão** (nunca uma que venha do input), atribui ao responsável da
conexão e liga os anexos.

- Resposta: `RelatoResumo` (`{ id, tipo, estado, numero, titulo }`).
- Em **modo teste**: `estado: "teste"` e `teste: { descricao }`, a descrição que a tarefa
  **teria**. Nenhuma tarefa é criada.

A **descrição** é montada pela Central com `montarDescricao`, a mesma função que o simulador
usa. Por isso o painel do simulador mostra o texto exato da tarefa. A ordem é: o que aconteceu
(+ "Mais detalhes" com as respostas), impacto, contexto técnico (quem, tela, navegador, anexos),
**Contexto do <SaaS>**, **Últimos eventos do <SaaS>** (só bug), erros, requisições que falharam e
navegação. O teto é de 12.000 caracteres. Para caber, saem primeiro o rastro mais antigo, depois
os eventos mais antigos e, por último, o contexto.

### `GET /relatos/meus` — `MeuRelatoExterno[]`

```json
{ "id": "…", "numero": 812, "tipo": "bug", "titulo": "…", "enviadoEm": "2026-10-06T17:02:11.000Z",
  "status": { "nome": "Corrigido", "cor": "#1fa971", "grupo": "done" },
  "conversa": true, "pendente": false, "novidadeEm": "2026-10-07T09:12:00.000Z" }
```

Só os relatos da pessoa do token (`conexão + sub`), só os enviados (os de modo teste não
aparecem), os 50 mais recentes. `pendente` indica uma pergunta esperando resposta.
`novidadeEm` é a última mudança de status ou pergunta, e acende o ponto do botão.

### Conversa

`GET /relatos/{id}/conversa` e `POST /relatos/{id}/respostas` devolvem
`{ "mensagens": [{ "id", "direcao": "pergunta" | "resposta", "texto", "autor": { "nome" } | null, "criadoEm" }], "pendente" }`.
De quem atende na Central, sai **só o nome**: nem id, nem e-mail.

A resposta é `{ "id": "<uuid do cliente>", "texto": "1 a 4.000 caracteres" }`. Anexos da
resposta sobem antes, pelo mesmo `PUT` de anexo. A resposta vira mensagem da conversa e um
comentário na tarefa ("Resposta de Marina (usuário do <SaaS>), pela Central de Bugs").

## Códigos de erro

| HTTP | `code` | Quando |
| --- | --- | --- |
| 401 | `TOKEN_INVALIDO` | token ausente, malformado, vencido, de outra conexão ou de outra chave |
| 403 | `ORIGEM_NAO_PERMITIDA` | `Origin` fora das origens da conexão (ou localhost fora do modo teste) |
| 404 | `CONEXAO_NAO_ENCONTRADA` | código de conexão desconhecido |
| 404 | — | relato que não existe **para esta pessoa** (de outra pessoa também dá 404) |
| 409 | `RELATO_ID_REUSADO` | o `id` do rascunho já pertence a outro relato |
| 409 | `RELATO_TIPO_INDISPONIVEL` | a conexão não tem lista para esse tipo |
| 409 | `RELATO_JA_ENVIADO` | anexo num relato já enviado, fora da resposta a uma pergunta pendente |
| 409 | `ATTACHMENT_ID_REUSED` | o `anexoId` já pertence a outro arquivo |
| 409 | `RELATO_ANEXOS_ESGOTADOS` | passou do teto de arquivos |
| 409 | `RELATO_SEM_PERGUNTA` | resposta sem pergunta pendente (ou relato de modo teste) |
| 409 | `MENSAGEM_ID_REUSADO` | o `id` da resposta já pertence a outra mensagem |
| 410 | `CONEXAO_DESLIGADA` | conexão desligada na Central |
| 410 | `RELATO_SEM_TAREFA` | a tarefa do relato foi removida |
| 413 | `RELATO_ANEXO_GRANDE` | arquivo acima do teto (`maxBytes` na resposta) |
| 415 | `RELATO_ANEXO_TIPO` | tipo de arquivo não aceito (decidido pelos bytes) |
| 422 | — | validação do corpo (`issues` traz o detalhe do zod) ou identificador inválido |
| 422 | `EXTRA_GRANDE_DEMAIS` | o `extra` não cabe em 8 KB nem sem os eventos |
| 429 | `RELATOS_LIMITE` | limite por pessoa: 10 relatos, 30 arquivos ou 30 mensagens por hora; ou 200 relatos por hora na conexão |
| 429 | `ANEXOS_LIMITE_DA_CONEXAO` | a conexão passou de 2 GB de anexos no dia |
| 503 | `CENTRAL_DE_BUGS_DESLIGADA` | a lista da conexão foi apagada |
| 503 | `CENTRAL_DE_BUGS_MAL_CONFIGURADA` | a lista deixou de ser de tarefas (o rascunho fica salvo) |
| 503 | `ATTACHMENT_STORAGE_UNAVAILABLE` | o armazenamento de arquivos da Central está fora |

O simulador responde os mesmos códigos e explica o motivo nos 401. Ele não aplica os limites de
429.

## Modo teste

Toda conexão nasce em modo teste. Nesse modo:

- o envio valida tudo e devolve `teste.descricao`, mas **não cria tarefa** (`estado: "teste"`);
- `http://localhost:*` e `http://127.0.0.1:*` são aceitos como origem;
- o relato não aparece em "Meus relatos" e não aceita conversa;
- a tela da conexão na Central lista os 20 últimos.

Sai-se do modo teste pela tela da conexão ou pelo agente (ferramenta MCP `sair_do_modo_teste`).
