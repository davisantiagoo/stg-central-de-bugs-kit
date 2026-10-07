---
name: triar-relatos
description: Faz a triagem dos relatos novos da Central de Bugs da STG de um SaaS. Lista o que está em "Novo" (Bugs) e "Nova" (Melhorias), agrupa duplicados, propõe prioridade, responsável e próximo status, e só grava depois da confirmação do dev (dry_run antes). Use quando pedirem "tria os bugs do <SaaS>", "o que chegou de novo na Central de Bugs", "organiza os relatos" ou "tem bug duplicado?".
argument-hint: "[nome do SaaS ou da pasta]"
---

# Triar os relatos da Central de Bugs

Escopo pedido: **$ARGUMENTS** (o nome do SaaS ou da pasta; se vier vazio, pergunte).

Você usa o MCP da Central (o servidor `central-de-bugs` deste plugin, ou o MCP da Central que
o dev já tinha configurado à mão — mesma URL, o Claude Code conecta um só), com a permissão de quem está logado.
**Nada é gravado sem confirmação**: toda escrita sai primeiro com `dry_run: true`, você mostra
o resultado e só repete sem `dry_run` com o "pode" do dev.

## 1. Achar as listas

As listas de cada SaaS se chamam **Bugs** e **Melhorias** e ficam na pasta escolhida na
instalação. Chame `explorar_listas` com `{ "busca": "Bugs" }` e depois `{ "busca": "Melhorias" }`,
e fique com as da pasta do SaaS pedido (o caminho `Space › Pasta › Lista` vem na resposta).
Se houver várias pastas candidatas, pergunte ao dev qual (AskUserQuestion).

Confirme os status com `listar_status_da_lista` em cada uma. O modelo é este:

- **Bugs:** Novo · Em análise · Precisa de informação · Em correção · Corrigido · Não reproduzi ·
  Duplicado · Não é bug
- **Melhorias:** Nova · Em avaliação · Precisa de informação · Planejada · Em desenvolvimento ·
  Entregue · Já existe · Não vamos fazer

Se a lista não tiver algum desses status (lista conectada pela tela), trabalhe com os que
existem e avise o dev.

## 2. Ler o que chegou

- `listar_tarefas` com `{ "lista": "<id da lista Bugs>", "status": "Novo" }`, e o mesmo na
  Melhorias com `"Nova"`. Se a resposta disser que foi limitada, pagine com o `cursor`
  devolvido e avise o dev que há mais do que o primeiro lote.
- Para cada relato, `detalhar_tarefa`. Não leia os itens sensíveis: a triagem não precisa
  deles, então **não use `incluir_sensiveis`**.
- Abra prints com `ver_anexo` só quando o texto não bastar para entender o relato, por exemplo
  para decidir se dois relatos são o mesmo erro.

## 3. Montar a proposta

Para cada relato, decida:

- **Duplicado de outro?** Mesmo caminho de URL e mesmo erro no rastro (mesma requisição com o
  mesmo status, mesma mensagem de console) ou o mesmo pedido em palavras diferentes. Procure
  também nos já tratados com `buscar_tarefas` (`estado: "todas"`). O original é o mais antigo,
  ou o que já está em andamento.
- **Prioridade** (`urgent`, `high`, `normal`, `low`). Parta do impacto que a pessoa marcou: em
  bug, "Travado" pende para `urgent`/`high`, "Atrapalha" para `normal` e "Detalhe" para `low`;
  em melhoria, "toda semana" pende para `high`. Ajuste por quantas pessoas relataram o mesmo
  (duplicados contam), pela frequência ("Toda vez") e pelo contexto (cliente, plano).
  Melhoria nunca é `urgent`.
- **Próximo status:**
  - bug claro e reproduzível → `Em análise` (ou fica em `Novo` para quem corrige pegar);
  - falta informação → `Precisa de informação`, com a pergunta sugerida (veja o passo 5);
  - duplicado → `Duplicado`, com comentário apontando o original;
  - não é defeito (é dúvida de uso ou comportamento esperado) → propor `Não é bug`;
  - melhoria → `Em avaliação`, `Já existe` (com o link) ou deixar para o dono do produto.
- **Responsável:** só proponha trocar se o dev pedir. Use `listar_pessoas_da_lista` para os
  nomes válidos.

Mostre ao dev **uma tabela única**: `#`, título, impacto, proposta (prioridade, status),
grupo de duplicados e uma linha de por quê. Ordene pelo que deveria ser atacado primeiro.

## 4. Aplicar o que o dev aprovar

Para cada linha aprovada:

1. `atualizar_tarefa` com `dry_run: true` (prioridade e/ou status). Mostre o lote inteiro de
   simulações de uma vez.
2. Com a confirmação, repita sem `dry_run`.
3. Nos duplicados, `comentar_tarefa` em cada cópia (`Duplicado de <título> (<id>)`), também
   com `dry_run` primeiro.

Se uma gravação for recusada por conflito (alguém mexeu na tarefa nesse meio-tempo), releia
com `detalhar_tarefa`, mostre ao dev o que mudou e pergunte de novo. Não repita às cegas.

## 5. Perguntas para quem relatou

O MCP não manda mensagem para fora da Central. Quando faltar informação, escreva a pergunta
sugerida na tabela. Depois do status `Precisa de informação`, o dev envia a pergunta pela
Central: no campo de comentário da tarefa, opção **"Para <nome de quem relatou>"**. Quem
relatou responde em "Meus relatos", dentro do SaaS.

## Fechamento

Termine com um resumo: quantos relatos entraram, quantos mudaram de status, os grupos de
duplicados e o que ficou esperando decisão humana (`Não é bug`, `Não vamos fazer`, troca de
responsável). Para corrigir um relato agora, a skill é `corrigir-relato`.
