# Login na Central e troca de conta

Consulta da skill `instalar-central-de-bugs`. O dev nunca roda comando nem abre o `/mcp` para
entrar na Central: você gera o link, ele clica. Nunca diga que "esta sessão não consegue abrir o
OAuth" e nunca peça para ele criar ou configurar algo à mão que você mesmo consegue fazer.

## 1. Achar o servidor da Central e o comando `claude`

**O comando.** Use `claude` se ele estiver no PATH (`command -v claude`). Se não estiver (quem
só instalou a extensão do VS Code ou do Cursor), use o binário que vem com a extensão:

```bash
ls -d ~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude \
      ~/.cursor/extensions/anthropic.claude-code-*/resources/native-binary/claude 2>/dev/null | tail -1
```

Chame o caminho achado de `$CLAUDE` nos passos abaixo.

**O servidor.** Rode `$CLAUDE mcp list` e ache a linha com a URL
`https://app.stgcompany.com.br/api/mcp`. O que vem antes de `:` é o nome do servidor
(`plugin:central-de-bugs:central-de-bugs` ou, se o dev configurou à mão, `central-stg` ou outro
nome). Chame-o de `<servidor>`. O status no fim da linha diz se precisa de login:
`✔ Connected` ou `! Needs authentication`. Se houver duas linhas com essa URL, o Claude Code usa
a configurada à mão: é essa que importa.

## 2. Gerar o link de login

**Terminal (CLI).** Se existir uma ferramenta `authenticate` do servidor da Central (procure
com ToolSearch, consulta `authenticate`), chame-a: ela devolve a URL. Depois que o dev autoriza,
as ferramentas aparecem na mesma sessão. Se a página final der erro de conexão (sessão remota),
peça a URL da barra de endereço e passe-a como `callback_url` para `complete_authentication`.

**VS Code, Cursor e app desktop** (não há `authenticate`): faça o login pela CLI, em segundo
plano (Bash com `run_in_background`). Ela precisa de um terminal, por isso o `script`:

```bash
# macOS
sleep 600 | script -q /dev/null "$CLAUDE" mcp login "<servidor>" > "${TMPDIR:-/tmp}/central-login.txt" 2>&1
# Linux
sleep 600 | script -q -c "\"$CLAUDE\" mcp login \"<servidor>\"" /dev/null > "${TMPDIR:-/tmp}/central-login.txt" 2>&1
```

Sem `script` (Windows): peça ao dev para rodar `claude mcp login "<servidor>"` no terminal
integrado e seguir o link que aparecer; é o único caso em que ele digita algo.

A CLI abre o navegador sozinha e escreve a URL no arquivo. Espere a URL aparecer (até ~20 s) e
extraia-a:

```bash
grep -o 'https://app.stgcompany.com.br/api/auth/mcp/authorize[^[:cntrl:][:space:]]*' "${TMPDIR:-/tmp}/central-login.txt" | head -1
```

Mande ao dev, com o link clicável:

> Abri a tela de login da Central no seu navegador. Se não abriu, use este link:
>
> **[Entrar na Central](<url>)**
>
> Confira a conta em **"Autorizando como"**. Se não for a certa, clique em **"Não é você?"** e
> entre com a certa: a autorização continua de onde parou. Confira também que aparece
> **"Instalar a Central de Bugs"** e autorize. Depois me diga "pronto".

Depois do "pronto", confira o arquivo: `Authenticated with "<servidor>"` é sucesso. Se ainda
diz "Waiting for authorization", o dev não concluiu: pergunte o que apareceu na tela. Erro
"Couldn't complete authentication": diga o motivo em uma frase e gere um link novo.

## 3. Fazer a sessão usar o login novo

O Claude Code guarda o login em disco, mas uma sessão já aberta não relê o disco sozinha:

- **A sessão já tinha as ferramentas da Central** (troca de conta, §4): chame
  `encerrar_esta_conexao` com `{ "confirmar": true }`. Ela derruba o login antigo na Central; a
  chamada seguinte recebe 401 e o Claude Code passa a usar o login novo, sem reiniciar. Confirme
  chamando `pastas_para_central_de_bugs`: `voce.email` tem de ser a conta nova.
- **A sessão não tinha as ferramentas** (primeiro login fora do terminal): elas só aparecem
  depois que a sessão reinicia. Peça uma vez só:

  > Pronto, você está conectado à Central. Para eu enxergar a conexão, recarregue a janela
  > (**Cmd+Shift+P → "Developer: Reload Window"**, no Windows Ctrl+Shift+P) e me mande
  > **"continuar a instalação da Central de Bugs"**.

  Por isso a skill confere o login **antes da Etapa 1**: o recarregamento acontece antes de
  qualquer trabalho.

## 4. Trocar de conta

Quando o dev diz que entrou com a conta errada, ou `voce.email` não é quem ele esperava, ou as
pastas que ele procura estão em outra conta:

1. Avise em uma frase: a troca vale para todos os projetos que usam `<servidor>` neste
   computador. Ofereça voltar para a conta anterior no fim, pelo mesmo caminho.
2. `"$CLAUDE" mcp logout "<servidor>"`. Isso apaga o login salvo; a sessão ainda usa o antigo
   na memória, e é isso que deixa o passo 4 funcionar.
3. Gere o link (§2). O navegador provavelmente abre logado na conta errada: a mensagem já diz
   para clicar em "Não é você?", e a autorização continua com a conta certa no mesmo link.
4. Depois do `Authenticated`, chame `encerrar_esta_conexao` (§3) e confira `voce.email`.

Se `encerrar_esta_conexao` responder que a conexão é um token pessoal (PAT): não há login para
trocar. Siga `problemas.md` §2 (PAT).
