# Quando algo não sai como esperado

Consulta da skill `instalar-central-de-bugs`. Cada seção diz o sintoma, a causa e o que fazer.
Explique ao dev em uma ou duas frases, sem despejar a tabela inteira.

## 1. Pacotes não instalam

- **404 na URL:** URL digitada errada ou versão inexistente. Use as da `referencia.md` §A.
- **Erro de rede (`ENOTFOUND`, `ECONNRESET`, timeout):** a rede bloqueia o download do GitHub
  (`github.com` redireciona para `*.githubusercontent.com`). Diga ao dev; não tente contornar.
- **`ERESOLVE` com `react` ou `fastify`:** o SaaS está abaixo do React 19 ou do Fastify 5. Pare
  e diga ao dev. Não atualize por conta própria.

## 2. A ferramenta `pastas_para_central_de_bugs` não aparece ou o login falha

- **O servidor pede autenticação:** não mande o dev para o `/mcp`. Siga `login.md` §1 a §3:
  você gera o link, ele clica.
- **Conta errada:** `login.md` §4. Na tela de autorização, "Não é você?" troca a conta sem
  perder o pedido.
- **Nem as ferramentas da Central nem o login aparecem, e `claude mcp list` mostra o servidor
  `✔ Connected`:** o servidor está desligado neste projeto. Acontece quando o dev tem um MCP da
  Central configurado à mão (`central-stg`, por exemplo) e o desligou aqui: o do plugin some
  junto, porque o Claude Code trata os dois como o mesmo servidor (mesma URL). Religue você
  mesmo: em `~/.claude.json`, tire o nome do servidor da lista `disabledMcpServers` do projeto
  (`projects["<caminho do projeto>"]`, faça cópia do arquivo antes) e peça um recarregamento da
  janela. Não precisa de login novo.
- **O dev já tinha o MCP da Central configurado à mão** (mesma URL): o Claude Code fica com o
  manual, que pode ter sido autorizado sem o escopo `central-de-bugs:instalar`.
  - **manual com token pessoal (PAT, cabeçalho `Authorization`)**: PAT NÃO concede a
    instalação. Proponha remover (`claude mcp remove <nome> -s <escopo>`; `claude mcp get <nome>`
    mostra o escopo, sem expor o token) e, com o sim do dev, remova e faça o login (`login.md`).
  - **manual com OAuth sem o escopo:** `claude mcp logout <nome>` e login de novo (`login.md`
    §2). Se a configuração fixar `oauth.scopes` sem `central-de-bugs:instalar`, acrescente-o.
- **"O token está restrito a algumas listas":** é um PAT com recorte. Mesmo caminho do PAT.
- **Login recusado ou 403 "Sem acesso ao módulo MCP":** a conta precisa de acesso ao módulo MCP
  na Central. Quem libera é o administrador da Central (o Davi). Se o dev tem outra conta com
  acesso, troque (`login.md` §4); senão, pare até isso estar resolvido.

## 3. A lista de pastas

A resposta vem como `{ voce: { email }, pastas: [...], spaces: [...] }`. Cada pasta vem com
`{ id, caminho, pasta, space: { id, nome }, podeInstalar, jaTem: { bugs, melhorias }, conexao?: { codigo, nome } }`.
Só aparecem pastas com **acesso total** (`manage`). `spaces` são os Spaces onde o dev pode
**criar** a pasta do SaaS (gestor ou owner, com acesso total ao Space): ofereça criar a pasta
lá (`nova_pasta`) em vez de pedir que alguém a crie.

- **`pastas` e `spaces` vazios:** o dev não administra nada. Se ele tem outra conta com acesso,
  troque (`login.md` §4). Senão, quem administra o Space precisa compartilhá-lo com ele como
  "acesso total" (ou instalar).

- **`jaTem` sem `conexao` (`podeInstalar: false`):** a instalação vai recusar. Não ofereça.
- **Pasta com `conexao`: já está instalada.** Veja a seção 4.

## 4. Reinstalação (a pasta já tem `conexao`)

Nunca chame `instalar_central_de_bugs` para ela, nem para outra pasta do mesmo SaaS (seriam
duas conexões para um produto). Pergunte se é este SaaS. Se for, reaproveite:

1. `npx central-de-bugs chave-publica --env <arquivo>` (só imprime a pública; sem chave, gere
   com `npx central-de-bugs chaves --env <arquivo>`).
2. `npx central-de-bugs verificar --central https://app.stgcompany.com.br --conexao <codigo> --env <arquivo>`.
3. **Passou:** siga para a Etapa 4 com o `codigo` existente.
4. **401:** a pública cadastrada é de outra chave. Nenhuma ferramenta MCP troca a chave: o dev
   abre **Configurações → Central de Bugs** na Central, escolhe a conexão, **Trocar a chave** e
   cola a linha que o `chave-publica` imprimiu. Rode o `verificar` de novo.

## 5. Erros de `instalar_central_de_bugs`

A ferramenta devolve o erro como **texto** (`isError`). Reconheça pela mensagem.

| A mensagem diz | Código interno | O que fazer |
| --- | --- | --- |
| a pasta já tem "Bugs"/"Melhorias" | `MCP_LISTA_JA_EXISTE` | com `conexao`: seção 4, sem instalar em outra pasta. Sem `conexao`: outra pasta. Nada foi criado |
| o campo levou uma chave **privada** | `MCP_CHAVE_PRIVADA_RECUSADA` | pare. A chave está comprometida: `chaves --forcar` e recomece com a pública nova |
| não é uma JWK P-256 pública | `MCP_CHAVE_INVALIDA` | use a linha exata do stdout da CLI |
| origem recusada | `MCP_ORIGEM_INVALIDA` | corrija para `https://host[:porta]`, sem caminho, sem curinga |
| sem acesso total à pasta | `MCP_SEM_ACESSO_DE_GESTAO` | volte à escolha da pasta |
| pasta (ou Space) arquivada | `MCP_PASTA_ARQUIVADA` | outra pasta, ativa |
| pasta não encontrada | `MCP_PASTA_NAO_ENCONTRADA` | use o `id` de `pastas_para_central_de_bugs` |
| ninguém com esse nome edita a pasta | `MCP_RESPONSAVEL_SEM_ACESSO` | outra pessoa ou o próprio dev |
| "corresponde a N …" com ids | (ambiguidade) | repita com o id ou o e-mail certo |
| criar pasta exige gestor com acesso total ao Space | `MCP_SEM_ACESSO_DE_GESTAO` | escolha um Space de `spaces`, ou uma pasta existente |
| o Space já tem a pasta "X" (id …) | `MCP_PASTA_JA_EXISTE` | instale nessa pasta pelo id, ou outro nome para a nova |
| Space não encontrado / arquivado | `MCP_SPACE_NAO_ENCONTRADO` / `MCP_SPACE_ARQUIVADO` | use um Space de `spaces` |
| informe a pasta OU a pasta nova | `MCP_PASTA_AMBIGUA` | mande só `pasta` ou só `nova_pasta` |

## 6. `verificar` falha

| Status | Causa | O que fazer |
| --- | --- | --- |
| 401 | a pública cadastrada não é a desta chave, ou o relógio está fora | seção 4, passo 4 |
| 404 | código da conexão errado | use o `codigo` da instalação |
| 410 | conexão desligada na Central | quem administra a religa na tela da conexão |
| 403 (com `--origem`) | origem fora da lista da conexão | acrescentar na tela da conexão |

## 7. O botão não aparece (local)

Olhe nesta ordem: o log do servidor (rota do token 401/503), o console do navegador (avisos
`[central-de-bugs]`) e as variáveis `VITE_` (o Vite só as lê ao subir: reinicie o dev server).

## 8. Produção: o que cada resposta da rota do token quer dizer

`curl -s -o /dev/null -w '%{http_code}' https://<origem>/api/central-de-bugs/token`, sem sessão:

| Código | Quer dizer | O que fazer |
| --- | --- | --- |
| **401** | plugin no ar e configurado. Só falta alguém logado | ✓ siga |
| **503** | plugin no ar, mas **sem a chave ou sem a conexão** no ambiente do servidor | volte às variáveis da Etapa 7: confira os nomes, se foram salvas e se o servidor reiniciou depois |
| **404** | o deploy não tem o plugin, ou a rota tem prefixo | confira se o deploy é do commit novo e o `prefix` do Fastify |
| **200 com HTML** | o proxy entrega o front para `/api/*` | a API do SaaS está em outra origem ou caminho: use esse |

**O botão não aparece em produção, mas a rota dá 401:** o front foi construído sem as `VITE_`.
Elas precisam estar disponíveis **no build** (no Coolify, marque como *Build Variable*) e o
front precisa de um **novo build** depois de salvas.

**"Origem não permitida" ao enviar:** a origem de produção não está na conexão. Acrescente na
tela da conexão na Central, exatamente `https://host[:porta]`.
