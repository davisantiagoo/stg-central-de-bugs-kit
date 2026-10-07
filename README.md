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

## O fluxo em 5 passos

No repositório do seu SaaS, abra o Claude Code e diga **"instala a Central de Bugs aqui"**.

1. **Login.** O navegador abre a Central. Você entra e autoriza, uma vez só. O mesmo login serve
   depois para corrigir os relatos.
2. **Pasta.** O agente mostra as pastas em que você tem acesso total, e você escolhe onde ficam
   os bugs do SaaS e quem recebe os relatos.
3. **Chaves e listas.** O agente gera o par de chaves na sua máquina. A privada vai para o
   `.env` e nunca é impressa. Ele cria na pasta as listas **Bugs** e **Melhorias**, com os status
   prontos, e a conexão com o SaaS, enviando só a chave **pública**. Antes de criar, ele mostra
   o que vai fazer e espera o seu ok.
4. **Código e teste.** O agente instala os pacotes, monta o widget, registra o plugin Fastify,
   propõe o `contexto()`, os `registrar()` e o `data-relato-ignorar` nas telas sensíveis
   (você aprova), e testa tudo no **simulador** local. Você vê a descrição exata que a tarefa
   terá.
5. **Produção.** Você configura as variáveis no Coolify, faz o deploy e relata algo de verdade.
   A conexão nasce em **modo teste**, então nada vira tarefa até você conferir e pedir "sai do
   modo teste da Central de Bugs".

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
   exemplo), o passo 2 da skill `instalar-central-de-bugs` e o CHANGELOG. Na Central, as
   constantes `PACOTES_PUBLICADOS` (`apps/server/src/modules/relatos/instalacao.ts`) e
   `PACOTES_DA_CENTRAL_DE_BUGS` (`apps/web/src/shell/relatos/conexoes.ts`), que a instalação e a
   tela da conexão mostram ao dev.
6. Confira de fora: `npm install <URL nova>` num diretório vazio, sem nenhum login.
