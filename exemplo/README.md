# Exemplo: um SaaS mínimo com a Central de Bugs

React + Vite no front e Fastify no servidor, o mesmo stack dos SaaS da STG, com a Central de
Bugs instalada do jeito que a skill `instalar-central-de-bugs` instala. Ele roda inteiro na sua
máquina, contra o **simulador** do kit: nenhum relato sai daqui.

O que olhar no código:

| Onde | O quê |
| --- | --- |
| `servidor/index.ts` | `app.register(centralDeBugs, { usuario })`, com uma sessão de mentira (cookie) |
| `src/App.tsx` | `<CentralDeBugs>` só na área logada, `contexto()`, `perguntas`, `registrar()`, `abrirCentralDeBugs()` e `data-relato-ignorar` |
| `.env.example` | as quatro variáveis, e qual é de servidor e qual vai para o navegador |
| `package.json` | os três pacotes `@stg/*` pela URL do Release, sem registry e sem token |

## Rodar

Pré-requisito: Node 20.19 ou mais novo. Os pacotes `@stg/*` vêm das URLs públicas do Release
([docs/guia.md](../docs/guia.md#1-versão-atual-dos-pacotes)), sem token.

```bash
npm install
cp .env.example .env
npm run chaves            # gera o par: a PRIVADA vai para o .env, a pública aparece na tela
```

Depois, em três terminais:

```bash
npm run simular           # a Central de mentira em http://localhost:4545 (painel em /painel)
npm run servidor          # Fastify em http://127.0.0.1:3000
npm run web               # Vite em http://localhost:5173
```

Abra http://localhost:5173 e entre como Marina ou João. Depois:

1. Abra o pedido **#812** e clique em **Publicar no canal**. A publicação falha de propósito
   (500), e isso fica registrado no rastro técnico e em "Últimos eventos".
2. Clique em **Bug ou sugestão**, descreva e envie.
3. Abra http://localhost:4545/painel. Lá está a **descrição exatamente como a tarefa ficaria na
   Central**:
   - "usuário do Exemplo";
   - o contexto do pedido, com o CPF como `🔒 sensível`;
   - a resposta da pergunta extra;
   - os eventos e a requisição que falhou;
   - o print, sem o painel "Dados do titular", que tem `data-relato-ignorar`.
4. No painel, mude o status para **Corrigido** ou mande uma **pergunta**. O botão do widget
   ganha um ponto, e **Meus relatos** mostra o status e a conversa, onde você responde.
5. Saia e entre como a outra pessoa: os relatos de uma não aparecem para a outra.

`npm run typecheck` confere os tipos do front e do servidor.

## Contra a Central de verdade (modo teste)

Depois da instalação, com a conexão ainda em **modo teste**:

1. no `.env`, troque `CENTRAL_DE_BUGS_CONEXAO` e `VITE_CENTRAL_DE_BUGS_CONEXAO` pelo `codigo`
   da instalação e `VITE_CENTRAL_DE_BUGS_URL` por `https://app.stgcompany.com.br`;
2. confira a conexão com `npm run verificar -- --conexao <codigo>`;
3. relate algo. Nada vira tarefa: a confirmação do widget mostra a descrição que a tarefa
   teria.

`http://localhost` só é aceito pela Central real enquanto a conexão está em modo teste.
