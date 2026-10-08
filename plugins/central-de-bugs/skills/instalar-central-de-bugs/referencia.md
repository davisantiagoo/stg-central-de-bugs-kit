# Referência técnica da instalação

Consulta da skill `instalar-central-de-bugs`. O fluxo está no `SKILL.md`; aqui ficam os
modelos de código e as regras de cada peça. Leia só a seção que a etapa pedir.

## A. Pacotes

São `.tgz` públicos, anexados ao Release `pacotes-v0.2.0` do repositório
`davisantiagoo/stg-central-de-bugs-kit`. Instalam pela URL, **sem token, sem `.npmrc` e sem
registry**.

| Pacote | Onde | URL |
| --- | --- | --- |
| `@stg/central-de-bugs` | front | `https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-0.2.0.tgz` |
| `@stg/central-de-bugs-fastify` | servidor | `https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-fastify-0.2.0.tgz` |
| `@stg/central-de-bugs-cli` | dev (devDependency) | `https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases/download/pacotes-v0.2.0/stg-central-de-bugs-cli-0.2.0.tgz` |

Com npm:

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

Requisitos: o widget pede **React 19+** e o plugin pede **Fastify 5**. Abaixo disso, pare e
diga ao dev. Não atualize o React nem o Fastify por conta própria.

## B. As quatro variáveis

| Variável | Onde | Secreta? | Local (desenvolvimento) | Produção |
| --- | --- | --- | --- | --- |
| `CENTRAL_DE_BUGS_CHAVE_PRIVADA` | servidor, runtime | **sim** | gerada pela CLI no `.env` | a mesma do `.env`, levada pelo arquivo de produção |
| `CENTRAL_DE_BUGS_CONEXAO` | servidor, runtime | não | `cdb_simulador00000000000` | o `codigo` da instalação |
| `VITE_CENTRAL_DE_BUGS_CONEXAO` | front, **build** | não | `cdb_simulador00000000000` | o `codigo` da instalação |
| `VITE_CENTRAL_DE_BUGS_URL` | front, **build** | não | `http://localhost:4545` | `https://app.stgcompany.com.br` |

As `VITE_` vão para o JavaScript do navegador e precisam existir **na hora do build**: o Vite as
embute, e mudar depois do build não tem efeito.

**Gravar no `.env` local sem ler o arquivo.** Ele tem a chave privada. Acrescente ou troque só a
linha da variável, sem imprimir nada:

```bash
node -e '
const fs = require("fs"); const [arq, nome, valor] = process.argv.slice(1);
const txt = fs.existsSync(arq) ? fs.readFileSync(arq, "utf8") : "";
const re = new RegExp("^\\s*(?:export\\s+)?" + nome + "\\s*=.*$", "m");
const novo = re.test(txt) ? txt.replace(re, nome + "=" + valor)
  : txt + (txt && !txt.endsWith("\n") ? "\n" : "") + nome + "=" + valor + "\n";
fs.writeFileSync(arq, novo, { mode: 0o600 });
' <arquivo> <NOME> <valor>
```

**`.env.example`** (vai para o git). Se não existir, crie. Acrescente:

```
# Central de Bugs: servidor. A chave privada é gerada por `npx central-de-bugs chaves` e NUNCA vai para o git.
CENTRAL_DE_BUGS_CHAVE_PRIVADA=
CENTRAL_DE_BUGS_CONEXAO=<codigo cdb_… da instalação; cdb_simulador00000000000 no simulador>
# Central de Bugs: front (vão para o navegador; nada secreto aqui)
VITE_CENTRAL_DE_BUGS_CONEXAO=<o mesmo codigo>
VITE_CENTRAL_DE_BUGS_URL=https://app.stgcompany.com.br
```

**Tipos**, em `vite-env.d.ts`, dentro de `ImportMetaEnv`:
`readonly VITE_CENTRAL_DE_BUGS_CONEXAO?: string` e `readonly VITE_CENTRAL_DE_BUGS_URL?: string`.

## C. Servidor: plugin do token

Registre **depois** da autenticação do SaaS, no mesmo contexto das rotas que leem a sessão:

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

- A rota é `GET /api/central-de-bugs/token` e responde `text/plain` com o JWT. Dentro de um
  contexto com `prefix`, o caminho ganha o prefixo: passe `rota` ou ajuste a função `token` do
  front.
- `id` vira o `sub` do token, a identidade da pessoa em "Meus relatos". Use o id **estável**,
  nunca o e-mail. Se o id puder se repetir entre clientes, use `` `${tenantId}:${userId}` ``.
  Até 128 caracteres.
- `email` é opcional e só serve para o aviso por e-mail, que vem desligado. Pergunte ao dev.
- Sem chave ou sem conexão no ambiente, o plugin **não derruba** o SaaS: loga o erro no boot e
  a rota responde **503**. Configurado e sem sessão, responde **401**. A Etapa 7 usa essa
  diferença para conferir o deploy.
- Opções: `chavePrivada` e `conexao` (padrão: as variáveis de ambiente), `rota` (padrão
  `/api/central-de-bugs/token`) e `duracaoS` (padrão 600, máximo 900).

## D. Front: o widget

Na raiz **autenticada**:

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
    contexto={/* seção E */}
  />
)}
```

Props: `conexao`, `central`, `token` (obrigatórias), `contexto`, `perguntas`, `versao`, `tela`,
`raizDoPrint`, `posicao` (`'direita' | 'esquerda'`), `textos` e `tema`. O visual (`tema`, `posicao`)
está na seção F.

`tela` e `raizDoPrint` são **funções**, não valores: o widget as chama na hora do relato.

- `tela?: () => string`: um título de tela melhor que o `document.title`. Nunca
  `tela="Pedidos › #812"`: o TypeScript recusa (TS2322), e sem typecheck o widget quebra.
- `raizDoPrint?: () => HTMLElement | null`: se o conteúdo rola dentro de um container, e não no
  `body`. Use `querySelector<HTMLElement>`.

```tsx
<CentralDeBugs
  /* …as props obrigatórias acima… */
  tela={() => (pedido ? `Pedidos › #${pedido.id}` : 'Pedidos')}
  raizDoPrint={() => document.querySelector<HTMLElement>('main')}
/>
```

Para abrir a Central de um menu de ajuda do SaaS: `abrirCentralDeBugs('bug')` ou
`abrirCentralDeBugs('sugestao', 'meus')`, exportados pelo mesmo pacote.

## E. O que capturar além do básico

### O básico, que o widget já captura sozinho

Não precisa de código: caminho da URL (sem query), título da tela, navegador, sistema, tamanho
da janela, fuso, versão do build, **print da tela**, e, em bug, os últimos 20 erros de console,
as últimas 15 requisições que falharam e as últimas 15 navegações. Quem relata é identificado
pelo token do servidor.

### `contexto()`: o estado do negócio no momento do relato

Lido na hora do relato e nunca perguntado à pessoa. Responde "em que situação ela estava?":
cliente/tenant, plano, entidade aberta, modo ou etapa de um fluxo.

- chave em `snake_case` (`^[a-z][a-z0-9_]{0,39}$`), no máximo 20 itens;
- valor primitivo (texto até 500, número, booleano, `null`) ou `{ valor, rotulo?, id?, sensivel? }`;
- `sensivel: true` em CPF, CNPJ de pessoa física, telefone, endereço, e-mail de cliente final e
  dado de pagamento. O valor sensível **não entra na descrição da tarefa**: fica só na ficha do
  relato;
- **nunca** token, senha, chave de API ou cookie;
- barato, síncrono e sem lançar erro: leia o que já está em memória (contexts, stores, cache do
  react-query, params da rota).

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

### `registrar(nome, detalhes)`: o que aconteceu antes do bug

Os últimos 30 eventos do domínio, em "Últimos eventos" do relato de **bug**. Responde "o que ela
fez até chegar aqui?". Proponha 3 a 6 pontos nos fluxos críticos, logo depois do sucesso ou da
falha. Detalhes planos, até 10 chaves, sem dado pessoal.

```ts
import { registrar } from '@stg/central-de-bugs'

registrar('catalogo trocado', { catalogo_id: catalogo.id, canal: catalogo.canal })
registrar('produto publicado', { produto_id: produto.id, canal: 'mercado_livre', variacoes: produto.variacoes.length })
registrar('publicacao falhou', { produto_id: produto.id, canal: 'shopee', motivo: erro.code ?? 'desconhecido' })
registrar('importacao concluida', { arquivo_linhas: linhas, erros: falhas })
```

### `perguntas`: só o que o código não sabe

Opcional e com parcimônia: no máximo 1 ou 2. Formato:
`{ chave, rotulo, tipo: 'texto' | 'opcao' | 'numero' | 'sim_nao', opcoes?, obrigatoria?, so_em?: 'bug' | 'sugestao', ajuda? }`.

Em `tipo: 'opcao'`, cada opção é texto ou `{ valor, rotulo?, icone?, descricao? }`. O gravado é
sempre o `valor` (estável, `snake_case`). Até 6 opções viram pílulas; mais que isso, seletor
com busca a partir de 9. Ícones só do pacote que o SaaS já usa (`lucide-react`,
`@heroicons/react`…), ~15px, sem cor fixa. Nunca instale um pacote de ícones só para isso.

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

### `data-relato-ignorar`: o que nunca sai no print

O print sai do SaaS para a Central. Procure nos componentes do front (`grep -ril`): `cpf`,
`cnpj`, `cartao`, `card`, `pix`, `iban`, `senha`, `password`, `token`, `salario`, `saldo`,
`extrato`, `telefone`, `endereco`, `nascimento`. Para cada achado, proponha o atributo no
**menor container** que tem o dado (o card, o painel, a tabela), nunca na página inteira.

## F. O visual do widget no SaaS

O widget nasce com um visual neutro (azul `#4f6bff`, fonte do sistema, raio 14px) e segue o
claro/escuro do **sistema operacional**. Sem adaptação, ele parece um corpo estranho no SaaS, e
num SaaS com seletor de tema próprio abre claro sobre uma tela escura. O visual é só do lado do
navegador: **nada muda no que chega à Central**, e o fluxo, os campos e as classes `.cdb-*`
continuam os mesmos em todo SaaS.

### O que dá para ajustar

| Chave do `tema` | Variável | Use do SaaS |
| --- | --- | --- |
| `acento` | `--cdb-acento` | a cor primária (botões de ação) |
| `textoNoAcento` | `--cdb-texto-no-acento` | o texto sobre a primária |
| `superficie` | `--cdb-superficie` | o fundo de card/diálogo |
| `superficie2` | `--cdb-superficie-2` | o fundo "muted"/secundário |
| `texto` | `--cdb-texto` | o texto principal |
| `texto2` | `--cdb-texto-2` | o texto secundário |
| `apagado` | `--cdb-apagado` | dicas e placeholders (muted foreground) |
| `borda` | `--cdb-borda` | a borda padrão |
| `perigo` / `sucesso` | `--cdb-perigo` / `--cdb-sucesso` | destructive / success |
| `raio` | `--cdb-raio` | o raio dos cards/diálogos (os menores derivam dele) |
| `fonte` | `--cdb-fonte` | a família que o SaaS **já carrega** (nunca adicione fonte externa) |
| `esquema` | atributo da raiz | `'auto'` (sistema), `'claro'` ou `'escuro'` |

Além disso: `posicao` (`'direita' | 'esquerda'`), para não cobrir um chat ou um botão flutuante do
SaaS, e `textos`, para o tom de voz do produto.

### Prefira apontar para as variáveis do SaaS

O widget mora num portal no `<body>`, e as variáveis CSS definidas no `:root`/`<html>` chegam
até ele. Então o `tema` pode **referenciar** as variáveis do SaaS em vez de copiar valores. Assim
o widget acompanha o modo escuro do SaaS e qualquer troca futura de marca, sem código novo.

| O SaaS usa | Como o `tema` fica |
| --- | --- |
| shadcn com Tailwind 3 (`--primary: 222 47% 11%`) | `acento: 'hsl(var(--primary))'` |
| shadcn com Tailwind 4 (`--primary: oklch(…)`) ou variáveis com a cor inteira | `acento: 'var(--primary)'` |
| Chakra | `acento: 'var(--chakra-colors-brand-500)'` (o token que o SaaS usa) |
| MUI ou tema só em JS | os valores de `theme.palette` direto, e `esquema` pelo `theme.palette.mode` |
| Tailwind sem variáveis CSS | os hex do `tailwind.config` direto |

Exemplo completo para shadcn (Tailwind 3), conferido no navegador:

```tsx
<CentralDeBugs
  /* …props obrigatórias… */
  tema={{
    acento: 'hsl(var(--primary))',
    textoNoAcento: 'hsl(var(--primary-foreground))',
    superficie: 'hsl(var(--card))',
    superficie2: 'hsl(var(--muted))',
    texto: 'hsl(var(--foreground))',
    texto2: 'hsl(var(--muted-foreground))',
    apagado: 'hsl(var(--muted-foreground))',
    borda: 'hsl(var(--border))',
    perigo: 'hsl(var(--destructive))',
    raio: 'var(--radius)',
    esquema: escuro ? 'escuro' : 'claro', // o estado de tema que o SaaS já tem
  }}
/>
```

**Mapeie as cores todas, não só o acento.** Uma cor que fica de fora segue o esquema do próprio
widget: mapear só o `acento` num SaaS escuro deixa o fundo do widget claro.

**`esquema`:** se o SaaS tem seletor de tema próprio, ligue-o ao estado dele (`'claro'` ou
`'escuro'`), mesmo com as cores mapeadas: sombras e o véu atrás do diálogo seguem o esquema. Se o
SaaS só segue o sistema, deixe `'auto'`. Se ele só tem um tema, fixe esse.

**Quando as variáveis não chegam:** se o SaaS aplica a classe de tema num wrapper dentro do
`#root` (e não no `<html>` ou no `<body>`), as variáveis desse wrapper não alcançam o portal. Nesse
caso, use valores literais e o `esquema` ligado ao estado do tema.

### Contraste

A cor da marca nem sempre serve de cor de ação: uma primária clara demais deixa o texto do botão
ilegível. O `relatar-teste.mjs --visual` mede o contraste (WCAG) com as cores **já resolvidas**
pelo navegador. Mínimos: 4.5 para texto (principal, secundário e o texto do botão) e 3 para
dicas, foco e erros. Se um par falhar, ajuste só aquele (por exemplo, `textoNoAcento` escuro
sobre uma primária clara) e meça de novo.
