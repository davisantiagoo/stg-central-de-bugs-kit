# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). A versão do plugin é a do
`plugins/central-de-bugs/.claude-plugin/plugin.json`. Os pacotes `@stg/central-de-bugs*` têm
versão própria: cada uma é um Release `pacotes-vX.Y.Z` deste repositório, com os três `.tgz`.

## [0.2.0] — 2026-10-07

### Pacotes (Release `pacotes-v0.2.0`)

- `stg-central-de-bugs-0.2.0.tgz`, `stg-central-de-bugs-fastify-0.2.0.tgz` e
  `stg-central-de-bugs-cli-0.2.0.tgz`. Os quatro pacotes (contrato incluído) sobem juntos para a
  0.2.0; só o widget mudou de comportamento. O contrato da API não mudou.
- Widget, perguntas `tipo: 'opcao'`: `opcoes` aceita, além de texto, objetos
  `{ valor, rotulo?, icone?, descricao? }` (tipo `OpcaoDaPergunta`, exportado). Retrocompatível:
  `string[]` continua valendo. O que vai em `extra.respostas` é sempre o `valor`. Opção sem
  `valor` em texto ou com `valor` repetido é ignorada, com aviso no console.
- Widget: as pílulas (até 6 opções, e sim/não) mostram o ícone da opção.
- Widget, correção: o campo de arquivo escondido aparecia como "Choose Files" abaixo de "Anexar
  arquivo" (o reset de CSS do widget desfazia o atributo `hidden`).
- Widget: com mais de 6 opções, o `<select>` nativo deu lugar a um seletor próprio, sem
  dependência nova: campo com o ícone e o rótulo escolhidos e chevron; lista com ícone, rótulo e
  descrição; busca a partir de 9 opções; setas, Home/End, PageUp/PageDown, Enter, Esc (fecha só
  o seletor, não o relato), Tab e digitar para pular; padrão ARIA de combobox com
  `aria-activedescendant`; abre embaixo ou em cima conforme o espaço, dentro do diálogo; segue o
  tema claro/escuro (`--cdb-*`), `prefers-reduced-motion` e telas estreitas (alvos de toque
  maiores, busca a 16px para o iOS não dar zoom). Pergunta opcional ganha "Sem resposta" no
  topo da lista.
- Widget: textos novos em `Textos`, sobrescrevíveis pela prop `textos`: `escolha`,
  `semResposta`, `buscarOpcao` e `nadaEncontrado`.

### Plugin `central-de-bugs` 0.2.0

- Skill `instalar-central-de-bugs`: instala os pacotes 0.2.0 e, no Passo 10, sabe propor
  opções com ícone do pacote de ícones que o SaaS já usa (nunca instala um só para isso).

### Documentação

- `docs/guia.md`: versão 0.2.0 no passo 1 e o formato novo de `opcoes`, com exemplo em
  lucide-react.

## [0.1.0] — 2026-10-06

Primeira versão, para o piloto no Acelera Catálogo.

### Pacotes (Release `pacotes-v0.1.0`)

- `stg-central-de-bugs-0.1.0.tgz` (`@stg/central-de-bugs`), `stg-central-de-bugs-fastify-0.1.0.tgz`
  (`@stg/central-de-bugs-fastify`) e `stg-central-de-bugs-cli-0.1.0.tgz`
  (`@stg/central-de-bugs-cli`), instalados pela URL do Release, sem registry e sem token. O
  contrato da API vai embutido nos três.

### Plugin `central-de-bugs` (marketplace `stg`)

- MCP `central-de-bugs` → `https://app.stgcompany.com.br/api/mcp`, por OAuth, pedindo os escopos
  `tarefas:ler`, `tarefas:escrever` e `central-de-bugs:instalar`. Nome próprio, e não
  `central-stg`, para não se confundir com o MCP da Central configurado à mão. O Claude Code
  trata como duplicado o servidor de plugin com a MESMA URL de um configurado à mão, e fica com
  o manual. A skill de instalação explica o que fazer nesse caso: reautenticar o manual por
  OAuth ou removê-lo se for PAT.
- Skill `instalar-central-de-bugs`:
  - reconhece o repositório;
  - instala os pacotes pelas URLs do Release, sem token;
  - lista as pastas (`pastas_para_central_de_bugs`) e pergunta a pasta e o responsável;
  - gera as chaves sem expor a privada;
  - instala com `dry_run` antes (`instalar_central_de_bugs`);
  - monta o widget e o plugin Fastify e propõe `contexto()`, `registrar()` e
    `data-relato-ignorar`;
  - testa no simulador (com `relatar-teste.mjs` quando há Playwright) e confere a conexão
    real com `verificar`;
  - entrega a lista do que fica com o dev, e sai do modo teste (`sair_do_modo_teste`) quando
    pedido.
- Skill `corrigir-relato`: do número do relato até "Corrigido"/"Entregue", com comentário do
  que mudou. Usa `incluir_sensiveis` só quando necessário e justificado.
- Skill `triar-relatos`: os "Novo"/"Nova" de um SaaS, duplicados, prioridade e status
  propostos, e escrita só com `dry_run` antes.

### Documentação

- `docs/guia.md`: instalação à mão, dos pacotes ao Coolify.
- `docs/contrato.md` e `docs/openapi.yaml`: a API externa inteira, com rotas, token, CORS,
  limites do `extra` e códigos de erro.
- `docs/privacidade.md`: o que é coletado, o que nunca é, `data-relato-ignorar` e `sensivel`.

### Exemplo

- `exemplo/`: SaaS mínimo React + Vite + Fastify com sessão de mentira (duas pessoas), o
  widget, o plugin, `contexto()` com item sensível, pergunta extra, `registrar()`,
  `data-relato-ignorar` e uma rota que falha de propósito para o rastro.
