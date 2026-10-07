---
name: corrigir-relato
description: Corrige um bug (ou implementa uma melhoria) que chegou pela Central de Bugs da STG, a partir do número do relato ou do id da tarefa. Lê a tarefa e o print pelo MCP da Central, acha a tela no código deste repositório, reproduz, corrige, roda os testes e move o relato para "Em correção" e "Corrigido" com um comentário do que mudou. Use quando pedirem "corrige o bug #812", "resolve o relato 812", "pega a melhoria #95" ou colarem o link de uma tarefa das listas Bugs/Melhorias.
argument-hint: "<número do relato ou id da tarefa>"
---

# Corrigir um relato da Central de Bugs

O pedido é: **$ARGUMENTS**. Esse pedido é um número de relato (`#812`, `812`, "bug 812",
"melhoria 95") ou o id de uma tarefa.

Você usa o MCP da Central: o servidor `central-de-bugs` deste plugin ou, se o dev já tinha o
MCP da Central configurado à mão (por exemplo `central-stg`), esse — os dois apontam para a
mesma URL e o Claude Code conecta um só. Ele age com a permissão de quem está
logado: se a tarefa não aparecer, é porque essa pessoa não alcança a lista. Não tente
contornar isso.

## Os status que você usa

As listas da Central de Bugs nascem com status fixos. Use **só estes** e pelo nome exato:

| Lista | Começou a mexer | Terminou | Falta informação |
| --- | --- | --- | --- |
| **Bugs** | `Em correção` | `Corrigido` | `Precisa de informação` |
| **Melhorias** | `Em desenvolvimento` | `Entregue` | `Precisa de informação` |

Os outros status (`Não reproduzi`, `Duplicado`, `Não é bug`, `Já existe`, `Não vamos fazer`)
são decisão humana. Proponha, mas só aplique se o dev pedir. Se a lista tiver sido conectada
pela tela e não tiver algum desses status, rode `listar_status_da_lista`, mostre os que existem
e pergunte qual usar.

## 1. Achar a tarefa

- **Id de tarefa:** vá direto ao passo 2.
- **Número:** a descrição de todo relato traz `bug #<n>` ou `sugestão #<n>`. Chame
  `buscar_tarefas` com `{ "texto": "bug #812" }` (ou `"sugestão #95"`), `estado: "todas"`.
  A busca é por trecho, então `bug #812` também casa `bug #8120`. Confira o número exato no
  resumo de cada resultado ou no `detalhar_tarefa`. Se não vier nenhuma, tente
  sem o tipo (`"#812"`). Se ainda assim não aparecer, diga ao dev que o relato não está numa
  lista que ele alcança e pare.

## 2. Ler tudo antes de mexer

Chame `detalhar_tarefa` com `{ "tarefa": "<id>" }`. Leia:

- a **descrição**: o que aconteceu, o que a pessoa esperava, o impacto, a frequência, a tela, a
  URL (só o caminho), a versão do build, o **Contexto do <SaaS>**, os **Últimos eventos** e o
  rastro técnico (erros de console, requisições que falharam e a navegação);
- o bloco **`relato`**: quem relatou (`relatadoPor`), de qual SaaS (`origem`), o `extra`
  estruturado e a **conversa** com quem relatou. Leia a conversa antes de concluir que falta
  informação: a resposta pode já estar ali;
- os **comentários** e o **histórico**: alguém pode já estar mexendo nisso;
- os **anexos**: abra os prints com `ver_anexo` (`{ "anexo": "<id>" }`). Logs de texto também
  abrem. Vídeo não abre por aqui, então peça ao dev para ver na Central se for decisivo.

**Itens sensíveis.** Itens de contexto marcados como sensíveis (CPF, cartão…) vêm escondidos.
Chame de novo com `incluir_sensiveis: true` **só se** o valor for necessário para reproduzir,
por exemplo um bug que só acontece com aquele CNPJ. Antes, diga ao dev **por quê**. Nunca
repita o valor sensível em comentário, commit, nome de teste ou fixture: use um valor
fictício com o mesmo formato.

Se a tarefa já estiver em `Corrigido`/`Entregue` ou num status fechado, pergunte ao dev se é
para reabrir antes de qualquer coisa.

## 3. Marcar que começou

Mova para `Em correção` (bug) ou `Em desenvolvimento` (melhoria) com `atualizar_tarefa`
(`{ "tarefa": "<id>", "status": "Em correção" }`). Se o dev pediu explicitamente para corrigir,
isso conta como confirmação e não precisa de `dry_run`. Se ele só pediu para "olhar" o relato,
use `dry_run: true`, mostre e espere.

Se a gravação for recusada por **conflito** (a tarefa mudou desde a leitura), releia com
`detalhar_tarefa` e decida de novo. Não repita a gravação às cegas.

## 4. Reproduzir no código deste repositório

- Ache a tela pelo **caminho da URL** do relato: rotas do react-router, nomes de páginas, o
  título da tela. Use os **Últimos eventos** e as **requisições que falharam**
  (`POST /api/… → 500`) para chegar à rota do servidor.
- Reproduza do jeito mais barato que existir: um teste automatizado que falha (o melhor, porque
  vira a prova da correção), o servidor local ou o simulador. Se não conseguir reproduzir,
  vá para o passo 6.

## 5. Corrigir e provar

- Faça a menor correção que resolve a causa, não o sintoma.
- Rode os testes do projeto (os scripts do `package.json`, começando pelos mais baratos). Não
  diga que está corrigido sem ver os testes passarem.
- Mostre o diff ao dev. Não faça commit nem push se ele não pedir.

Depois, com o dev de acordo:

1. `comentar_tarefa` com o que mudou: a causa em uma frase, os arquivos tocados, como foi
   testado e, se houver, o commit ou PR. Escreva para quem cuida da lista, que não leu o
   código. Nada de dado sensível.
2. `atualizar_tarefa` com o status `Corrigido` (bug) ou `Entregue` (melhoria).

Quem relatou vê o novo status em "Meus relatos", no próprio SaaS, e recebe e-mail se a conexão
tiver o aviso ligado. Por isso, só marque como corrigido o que já está corrigido no código que
vai para produção. Se ainda falta deploy, diga isso no comentário.

## 6. Quando falta informação ou não reproduz

- **Falta informação de quem relatou:** o MCP **não manda mensagem** para fora da Central. Faça
  assim:
  1. Escreva a pergunta, curta e concreta. Mostre ao dev.
  2. `comentar_tarefa` registrando o que foi investigado e o que falta (isso fica para a
     equipe).
  3. `atualizar_tarefa` com o status `Precisa de informação`.
  4. Diga ao dev para enviar a pergunta **pela Central**: no campo de comentário da tarefa,
     escolher **"Para <nome de quem relatou>"**. A pergunta chega a quem relatou em "Meus
     relatos", dentro do SaaS. Quando a resposta vier, ela aparece na conversa do relato e como
     comentário na tarefa.
- **Não reproduz:** comente o que foi tentado (ambiente, passos, dados) e **proponha**
  `Não reproduzi`. Só aplique se o dev concordar.
- **É duplicado:** ache o original com `buscar_tarefas`, comente o link e proponha `Duplicado`.

## O que esta skill não faz

O MCP não exclui, não arquiva, não move tarefas entre listas e não fala com quem relatou. Se o
dev pedir algo assim, diga que é pela interface da Central.
