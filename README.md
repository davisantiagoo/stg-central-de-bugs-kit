# stg-central-de-bugs-kit

Tudo o que quem desenvolve um SaaS da STG precisa para ligá-lo à **Central de Bugs**, sem
acesso ao código da Central.

Quem usa o seu SaaS clica em **"Bug ou sugestão"**, descreve o problema, e o relato chega à
Central como **tarefa** na lista **Bugs** ou **Melhorias** de uma pasta sua. A tarefa já traz o
print, a tela, o contexto do seu domínio e o rastro técnico. Você corrige pelo Claude Code
("corrige o bug #812"), e quem relatou acompanha o status e responde perguntas em **"Meus
relatos"**, dentro do próprio SaaS.

| Peça | O que é |
| --- | --- |
| [`plugins/central-de-bugs`](plugins/central-de-bugs) | plugin do Claude Code: o MCP da Central (OAuth) e as skills `instalar-central-de-bugs`, `corrigir-relato` e `triar-relatos` |
| `@stg/central-de-bugs` | o widget React `<CentralDeBugs>`, `registrar()` e `abrirCentralDeBugs()` |
| `@stg/central-de-bugs-fastify` | o plugin Fastify que assina o token de quem relata |
| `@stg/central-de-bugs-cli` | `central-de-bugs chaves`, `simular` (a Central de mentira, local) e `verificar` |
| [`docs/`](docs) | [guia manual](docs/guia.md), [contrato da API](docs/contrato.md) + [OpenAPI](docs/openapi.yaml), [privacidade](docs/privacidade.md) |
| [`exemplo/`](exemplo) | um SaaS mínimo (React + Vite + Fastify) com tudo instalado, para rodar contra o simulador |

Os pacotes são públicos e **não pedem token**: são arquivos `.tgz` anexados aos
[Releases](https://github.com/davisantiagoo/stg-central-de-bugs-kit/releases) deste repositório,
instalados pela URL ([guia, passo 1](docs/guia.md#1-versão-atual-dos-pacotes), onde estão a
versão atual e as três URLs). O código deles é só cliente: o widget, o plugin que roda no seu
servidor e a CLI com o simulador. A Central continua privada. Stack suportado: React 19+ com Vite
no front e Fastify 5 com Node 20.19+ no servidor.

## Instalar o plugin no Claude Code

```
/plugin marketplace add davisantiagoo/stg-central-de-bugs-kit
/plugin install central-de-bugs@stg
```

O plugin não carrega segredo nenhum. O MCP da Central (`https://app.stgcompany.com.br/api/mcp`,
servidor `central-de-bugs` do plugin) conecta por OAuth, com o seu login. Se você já tem o MCP
da Central configurado à mão (por exemplo `central-stg`), o Claude Code fica com ele e oculta o
do plugin, porque a URL é a mesma. Se o seu é por token pessoal (PAT), remova-o: PAT não
concede a instalação. Se é por OAuth, reautentique-o em `/mcp` para autorizar o escopo
`central-de-bugs:instalar`. Você precisa de:

- **conta na Central**, com acesso ao módulo MCP (peça ao administrador da Central);
- **acesso total** à pasta da Central onde as listas do seu SaaS vão ficar.

Para os pacotes você não precisa de nada: nem conta no GitHub, nem token, nem `.npmrc`.

## O fluxo em 7 etapas

No repositório do seu SaaS, abra o Claude Code e diga **"instala a Central de Bugs aqui"**. O
agente anuncia as etapas, diz em qual você está e o que precisa de você, e mostra tudo antes de
alterar.

1. **Entender o projeto.** Só leitura: stack, login, entidades, fluxos críticos, deploy. Você vê
   um retrato do que ele entendeu.
2. **Decidir o que capturar.** Além do básico que o widget já leva (print, tela, erros de
   console, requisições que falharam), ele propõe um **plano de captura**: o contexto do negócio
   no momento do relato, os eventos que antecedem um bug, perguntas extras e as áreas que ficam
   fora do print. Você aprova ou ajusta.
3. **Conectar à Central.** O navegador abre a Central para o login. Você escolhe a pasta e quem
   recebe os relatos. As chaves são geradas na sua máquina: a privada vai para o `.env` e nunca é
   impressa. As listas **Bugs** e **Melhorias** e a conexão são criadas depois do seu ok.
4. **Implementar.** Widget, plugin Fastify e o plano de captura, com o diff na sua frente. O
   widget ganha o visual do seu SaaS: cores, cantos e fonte vêm das suas variáveis CSS, e o modo
   escuro acompanha o seu.
5. **Variáveis de ambiente.** As locais (apontando para o simulador), o `.env.example` e um
   arquivo `.env.central-de-bugs.producao`, fora do git, com as quatro variáveis de produção
   prontas para colar.
6. **Testar localmente.** Um bug de teste no **simulador**, e você vê a descrição exata que a
   tarefa terá. Com Playwright, o agente também mostra prints do widget nos dois temas e mede o
   contraste das cores.
7. **Publicar e testar em produção.** Na hora certa, o agente põe as variáveis de produção na sua
   área de transferência e diz onde colar. Depois ele publica (com o seu sim), confere o deploy
   e pede um relato real. A conexão nasce em **modo teste**: nada vira tarefa até você conferir e
   ele ligar de vez.

Depois disso:

- **"corrige o bug #812"**: lê a tarefa e o print, acha a tela no código, corrige, roda os
  testes e move para "Corrigido".
- **"tria os bugs do <SaaS>"**: agrupa duplicados e propõe prioridade e status. Nada é gravado
  sem a sua confirmação.

Prefere fazer à mão? O [guia](docs/guia.md) tem o mesmo passo a passo.

## Experimentar sem instalar nada no seu SaaS

```bash
cd exemplo
npm install && cp .env.example .env && npm run chaves
npm run simular    # terminal 1
npm run servidor   # terminal 2
npm run web        # terminal 3 → http://localhost:5173
```

Veja o [README do exemplo](exemplo/README.md).

## Segurança, em uma linha cada

- A chave privada nasce e fica no servidor do SaaS. A Central só conhece a pública.
- O código da conexão (`cdb_…`) é público e sozinho não cria relato.
- O token de quem relata dura no máximo 15 minutos e só vale para a sua conexão.
- A Central só aceita chamadas das origens cadastradas na conexão, e nunca com cookie.
- O que você marca como sensível não entra no texto da tarefa ([privacidade](docs/privacidade.md)).

## Versões

Veja o [CHANGELOG](CHANGELOG.md). A versão do plugin está em
`plugins/central-de-bugs/.claude-plugin/plugin.json`. Os pacotes têm versão própria, e cada uma
é um Release `pacotes-vX.Y.Z` deste repositório.

## Lançar uma versão dos pacotes

Para quem mantém o kit. O código dos pacotes mora no repositório (privado) da Central, em
`packages/`; aqui chegam só os `.tgz`. O CI da Central não lança: o token de um workflow não
escreve em outro repositório, então o lançamento é feito à mão, de uma máquina com o repositório
da Central e o `gh` autenticado.

1. No repositório da Central, suba a `version` dos quatro `packages/*/package.json` (contrato
   incluído) para a **mesma** `X.Y.Z`. Versão lançada não se relança com outro conteúdo: quem já
   instalou tem o hash do `.tgz` antigo no lock.
2. `npm run typecheck:packages && npm run test:packages`.
3. `node scripts/publicar-pacotes.mjs`. Ele gera os três `.tgz` em `.publicar/tarballs/`,
   instala-os num projeto vazio fora do monorepo, importa cada um, roda `central-de-bugs --ajuda`
   e, no fim, imprime o comando do Release e as URLs novas.
4. Crie o Release com os três arquivos:

   ```bash
   gh release create pacotes-vX.Y.Z \
     .publicar/tarballs/stg-central-de-bugs-X.Y.Z.tgz \
     .publicar/tarballs/stg-central-de-bugs-fastify-X.Y.Z.tgz \
     .publicar/tarballs/stg-central-de-bugs-cli-X.Y.Z.tgz \
     --repo davisantiagoo/stg-central-de-bugs-kit --title "Pacotes X.Y.Z" --notes "…"
   ```

5. Atualize as URLs aqui no kit: o bloco do [guia, passo 1](docs/guia.md#1-versão-atual-dos-pacotes),
   o `exemplo/package.json` (e o `exemplo/package-lock.json`, se houver, com `npm install` no
   exemplo), a seção A do `referencia.md` da skill `instalar-central-de-bugs` e o CHANGELOG. Na Central, as
   constantes `PACOTES_PUBLICADOS` (`apps/server/src/modules/relatos/instalacao.ts`) e
   `PACOTES_DA_CENTRAL_DE_BUGS` (`apps/web/src/shell/relatos/conexoes.ts`), que a instalação e a
   tela da conexão mostram ao dev.
6. Confira de fora: `npm install <URL nova>` num diretório vazio, sem nenhum login.
