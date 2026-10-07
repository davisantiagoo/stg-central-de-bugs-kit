# Privacidade: o que a Central de Bugs coleta

Ao instalar a Central de Bugs, o seu SaaS passa a mandar dados para a Central da STG. Quando
alguém relata um bug, o print da tela, o contexto e o rastro técnico saem do seu produto e ficam
guardados na Central. Isso inclui dados dos **clientes do seu SaaS**. Este documento diz o que
vai, o que nunca vai e como você controla isso.

## O que vai para a Central

**Só quando a pessoa envia um relato.** O widget não manda nada sozinho, e enquanto ninguém
relata nada sai do navegador.

| O quê | De onde | Detalhe |
| --- | --- | --- |
| **Identidade de quem relata** | token assinado pelo seu servidor | `sub` (o id da pessoa no seu SaaS), `nome` e, se você mandar, `email` |
| **O que a pessoa escreveu** | formulário | o que aconteceu, o complemento, o impacto, a frequência e as respostas às perguntas extras |
| **Print da tela** | widget, no clique do botão | uma imagem do `body` (ou da `raizDoPrint`), **sem** os elementos com `data-relato-ignorar` e sem o próprio widget |
| **Anexos e gravação** | a pessoa, por escolha dela | arquivos que ela anexa ou cola, e a gravação de tela, que só começa quando ela clica e o navegador pede permissão |
| **Contexto técnico** | navegador | o **caminho** da URL (sem query nem fragmento), o título da tela, o navegador e o sistema, o tamanho da janela, se está online, o fuso e a versão do build |
| **Rastro técnico** (só em bug) | navegador | últimos 20 erros de console (`console.error`, erros não tratados), últimas 15 requisições **que falharam** (método, caminho sem query, status e os campos `error`/`code` do JSON de erro) e últimas 15 navegações (só caminhos) |
| **Contexto do SaaS** | o seu `contexto()` | o que você declarou, até 20 itens |
| **Eventos do domínio** (só em bug) | os seus `registrar()` | os últimos 30, com até 10 detalhes cada |

## O que **nunca** é coletado

- corpo de requisição e corpo de resposta bem-sucedida;
- cabeçalhos HTTP, cookies e tokens de sessão do seu SaaS;
- query string e fragmento das URLs, porque podem carregar token, e-mail ou filtro com dado de
  cliente;
- `localStorage`, `sessionStorage` e o conteúdo de campos de formulário do seu SaaS (o print
  mostra o que está **na tela**, nada além);
- chamadas à própria Central de Bugs (o rastro as ignora);
- a chave privada do seu servidor, que nunca sai dele: nem para a Central, nem para o
  navegador, nem para o agente.

O widget não usa cookie da Central (`credentials: 'omit'`) e não sabe quem a pessoa é na Central.
Usuários do seu SaaS **não** viram usuários da Central.

## Como você controla

### `data-relato-ignorar`, para o que nunca deve sair no print

```tsx
<section data-relato-ignorar>
  <h3>Dados do titular</h3>
  <p>CPF {titular.cpf} · Cartão final {cartao.final}</p>
</section>
```

Um elemento com esse atributo, e tudo dentro dele, **não aparece no print automático**. Use no
menor container que tem o dado (o card, o painel, a tabela), não na página inteira. Marque:

- documentos (CPF, CNPJ de pessoa física, RG), dados de pagamento (cartão, conta, Pix), saldos,
  extratos e salários;
- dados de contato do cliente final (telefone, endereço, e-mail);
- qualquer tela de credenciais ou chaves de integração.

A skill `instalar-central-de-bugs` procura essas telas e propõe o atributo. Antes de enviar, a
pessoa ainda pode **tarjar** qualquer parte do print no editor de marcação.

O atributo vale para o print **automático**. Uma gravação de tela ou uma captura pelo
navegador (`getDisplayMedia`), feitas por escolha da pessoa, mostram o que estiver na tela.

### `sensivel: true` no `contexto()`

```ts
contexto={() => ({
  lojista: { valor: lojista.nome, id: lojista.id },
  cnpj_do_lojista: { valor: lojista.cnpj, sensivel: true },
})}
```

O valor sensível **não entra na descrição da tarefa**, que é copiada, citada e lida por agentes.
Lá aparece `🔒 sensível — ver no relato`. Ele fica guardado no relato e só aparece:

- na ficha do relato, para quem já tem acesso à tarefa na Central;
- no MCP, só quando quem lê a tarefa pede explicitamente (`incluir_sensiveis`).

Ele **nunca** aparece em "Meus relatos", em e-mail ou no texto da tarefa.

Não coloque no `contexto()` nada que não ajude a corrigir um bug, e nunca segredos (tokens,
senhas, chaves de API).

### O `email` no token

É opcional. Só serve ao aviso por e-mail para quem relatou, que vem **desligado** por padrão em
cada conexão. Se você não pretende ligar o aviso, não mande o e-mail.

## Quem vê os relatos na Central

Quem tem acesso às listas **Bugs** e **Melhorias** da conexão, pelo compartilhamento da pasta
na Central. É a mesma regra de qualquer tarefa. Quem relatou **não** vê a tarefa: vê só o
próprio relato em "Meus relatos" (o status e a conversa). De quem atende, ele vê só o nome.

## Retenção

- Rascunhos que nunca foram enviados são apagados em **24 horas**, com os arquivos.
- Relatos de **modo teste** são apagados em **7 dias**.
- Relatos enviados viram tarefas e seguem a vida da tarefa na Central. A retenção dos anexos
  de SaaS externos (proposta: 90 dias depois de fechar) é uma decisão da STG, registrada no
  plano da Central de Bugs.

## Limites que protegem o seu SaaS e a Central

- Por pessoa: 10 relatos, 30 arquivos e 30 mensagens por hora.
- Por conexão: 200 relatos por hora e 2 GB de anexos por dia. Isso contém um widget com defeito
  ou uma chave vazada.
- Arquivos: só imagem, vídeo, PDF e texto, com o tipo conferido pelos bytes. Até 10 MB por
  arquivo, e o vídeo tem teto próprio.
