#!/usr/bin/env node
/**
 * Monta as variáveis de PRODUÇÃO da Central de Bugs num arquivo pronto para
 * colar no painel do deploy (Coolify, Vercel, Railway…), e mostra na tela o
 * que vai em cada lugar — com a chave privada MASCARADA.
 *
 *   node variaveis-de-producao.mjs --env <.env do servidor> --conexao <cdb_…>
 *                                  [--central https://app.stgcompany.com.br]
 *                                  [--saida <arquivo>] [--copiar]
 *   node variaveis-de-producao.mjs --env <.env do servidor> --remover [--saida <arquivo>]
 *
 * POR QUE UM SCRIPT. A chave privada nunca passa pelo agente: ele não pode ler
 * o .env, e o que o terminal imprime entra na conversa. Mas o dev precisa
 * levar essa chave para produção, e copiar uma linha de dentro de um .env cheio
 * de segredos é justamente o passo em que as instalações travavam. Este script
 * é a única peça que lê a privada: copia o valor para um arquivo próprio
 * (ignorado pelo git, permissão 600) e, com --copiar, para a área de
 * transferência. O stdout só tem nomes, valores públicos e a privada como ••••.
 *
 * Sem dependências: roda com o Node do dev, antes ou depois de instalar os pacotes.
 *
 * Saída: o resumo no stdout; erros no stderr.
 * Códigos: 0 ok · 1 falhou · 2 uso errado.
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const AJUDA = `Uso: node variaveis-de-producao.mjs --env <.env do servidor> --conexao <cdb_…> [opções]

  --env <arquivo>     o .env do servidor, onde está CENTRAL_DE_BUGS_CHAVE_PRIVADA (padrão: .env)
  --conexao <cdb_…>   o código da conexão que a instalação devolveu
  --central <url>     a URL da Central (padrão: https://app.stgcompany.com.br)
  --saida <arquivo>   onde gravar (padrão: .env.central-de-bugs.producao, ao lado do --env)
  --copiar            copia o conteúdo do arquivo para a área de transferência
  --remover           apaga o arquivo de saída (depois de colado no painel)
`

const CHAVE = 'CENTRAL_DE_BUGS_CHAVE_PRIVADA'
const CENTRAL_PADRAO = 'https://app.stgcompany.com.br'
const NOME_SAIDA = '.env.central-de-bugs.producao'

class ErroDeUso extends Error {}

function lerArgs(argv) {
  const valores = new Map()
  const flags = new Set()
  const comValor = ['env', 'conexao', 'central', 'saida']
  const semValor = ['copiar', 'remover', 'ajuda']
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') { flags.add('ajuda'); continue }
    if (!arg.startsWith('--')) throw new ErroDeUso(`Argumento inesperado: ${arg}`)
    const [nome, embutido] = arg.slice(2).split(/=(.*)/s, 2)
    if (semValor.includes(nome)) flags.add(nome)
    else if (comValor.includes(nome)) {
      const valor = embutido ?? argv[++i]
      if (valor === undefined || valor.startsWith('--')) throw new ErroDeUso(`--${nome} precisa de um valor`)
      valores.set(nome, valor)
    } else throw new ErroDeUso(`Opção desconhecida: --${nome}`)
  }
  return { valores, flags }
}

/** Mesma leitura da CLI: `export` opcional, aspas removidas, a última ocorrência vence. */
function lerVariavel(arquivo, nome) {
  if (!existsSync(arquivo)) return null
  const padrao = new RegExp(`^\\s*(?:export\\s+)?${nome}\\s*=(.*)$`)
  let valor = null
  for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const casou = linha.match(padrao)
    if (casou) valor = casou[1].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return valor
}

/** 0 = ignorado, 1 = não ignorado, outro = git indisponível. */
function ignoradoPeloGit(arquivo) {
  const r = spawnSync('git', ['-C', path.dirname(arquivo), 'check-ignore', '-q', '--', path.basename(arquivo)])
  return r.status
}

/** Tenta os copiadores de cada sistema; devolve o nome do que funcionou, ou null. */
function copiar(texto) {
  const candidatos = process.platform === 'darwin'
    ? [['pbcopy', []]]
    : process.platform === 'win32'
      ? [['clip', []]]
      : [['wl-copy', []], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]]
  for (const [cmd, args] of candidatos) {
    const r = spawnSync(cmd, args, { input: texto })
    if (r.status === 0) return cmd
  }
  return null
}

function main(argv) {
  const { valores, flags } = lerArgs(argv)
  if (flags.has('ajuda')) { process.stdout.write(AJUDA); return 0 }

  const env = path.resolve(valores.get('env') ?? '.env')
  const saida = path.resolve(valores.get('saida') ?? path.join(path.dirname(env), NOME_SAIDA))
  const nomeSaida = path.relative(process.cwd(), saida) || saida

  if (flags.has('remover')) {
    if (!existsSync(saida)) { process.stdout.write(`${nomeSaida} já não existe.\n`); return 0 }
    rmSync(saida)
    process.stdout.write(`✓ ${nomeSaida} apagado. A chave privada continua no ${path.relative(process.cwd(), env)} e no painel de produção.\n`)
    return 0
  }

  const conexao = (valores.get('conexao') ?? '').trim()
  if (!conexao) throw new ErroDeUso('Falta --conexao <cdb_…> (o código que a instalação devolveu)')
  if (!/^cdb_[a-z0-9]{20}$/.test(conexao)) {
    process.stderr.write(`✗ "${conexao}" não é um código de conexão (esperado cdb_ + 20 letras minúsculas ou dígitos).\n`)
    return 1
  }
  if (conexao === 'cdb_simulador00000000000') {
    process.stderr.write('✗ Esse é o código do simulador. Em produção vai o código que a instalação na Central devolveu.\n')
    return 1
  }
  const central = (valores.get('central') ?? CENTRAL_PADRAO).trim().replace(/\/+$/, '')
  if (!/^https:\/\/[^/\s]+$/.test(central)) {
    process.stderr.write(`✗ --central tem de ser https://host, sem caminho: ${central}\n`)
    return 1
  }

  const privada = lerVariavel(env, CHAVE)
  if (!privada) {
    process.stderr.write(`✗ Não encontrei ${CHAVE} em ${path.relative(process.cwd(), env)}. Gere com: npx central-de-bugs chaves --env <arquivo>\n`)
    return 1
  }

  const git = ignoradoPeloGit(saida)
  if (git === 1) {
    process.stderr.write(`✗ ${nomeSaida} não está no .gitignore. Ele vai guardar a chave privada.\n`
      + `  Acrescente "${path.basename(saida)}" ao .gitignore e rode de novo.\n`)
    return 1
  }

  const conteudo = [
    '# Central de Bugs: variáveis de PRODUÇÃO',
    `# Gerado em ${new Date().toISOString().slice(0, 10)}. Cole no painel de variáveis do deploy`,
    '# e apague este arquivo depois. NUNCA versione, NUNCA cole em chat.',
    '',
    '# Servidor (runtime)',
    `${CHAVE}=${privada}`,
    `CENTRAL_DE_BUGS_CONEXAO=${conexao}`,
    '',
    '# Front: precisam existir no BUILD (o Vite embute no JavaScript)',
    `VITE_CENTRAL_DE_BUGS_CONEXAO=${conexao}`,
    `VITE_CENTRAL_DE_BUGS_URL=${central}`,
    '',
  ].join('\n')
  writeFileSync(saida, conteudo, { mode: 0o600 })
  chmodSync(saida, 0o600) // writeFileSync só aplica o modo ao criar

  const mascara = `•••••••• (secreta, ${privada.length} caracteres)`
  const linhas = [
    ['Servidor · runtime', CHAVE, mascara],
    ['Servidor · runtime', 'CENTRAL_DE_BUGS_CONEXAO', conexao],
    ['Front · build', 'VITE_CENTRAL_DE_BUGS_CONEXAO', conexao],
    ['Front · build', 'VITE_CENTRAL_DE_BUGS_URL', central],
  ]
  const larg = [0, 1, 2].map((i) => Math.max(...linhas.map((l) => l[i].length), ['Onde', 'Variável', 'Valor'][i].length))
  const fmt = (l) => `  ${l.map((c, i) => c.padEnd(larg[i])).join('   ').trimEnd()}\n`

  let texto = `\n✓ Variáveis de produção gravadas em ${nomeSaida} (permissão 600, fora do git).\n\n`
    + fmt(['Onde', 'Variável', 'Valor'])
    + `  ${larg.map((n) => '─'.repeat(n)).join('   ')}\n`
    + linhas.map(fmt).join('')

  if (flags.has('copiar')) {
    const com = copiar(conteudo)
    texto += com
      ? `\n✓ O conteúdo do arquivo (com a chave de verdade) foi copiado para a área de transferência (${com}).\n`
        + '  É só colar no painel de variáveis.\n'
      : `\n! Não achei um copiador neste sistema. Abra ${nomeSaida} no seu editor e copie de lá.\n`
  } else {
    texto += `\n  Para copiar: abra ${nomeSaida} no seu editor, ou rode de novo com --copiar.\n`
  }
  if (git !== 0) texto += '\n! Não consegui confirmar pelo git que o arquivo está ignorado (pasta sem git?). Não versione este arquivo.\n'
  process.stdout.write(texto)
  return 0
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (erro) {
  if (erro instanceof ErroDeUso) {
    process.stderr.write(`${erro.message}\n\n${AJUDA}`)
    process.exitCode = 2
  } else {
    process.stderr.write(`✗ ${erro instanceof Error ? erro.message : String(erro)}\n`)
    process.exitCode = 1
  }
}
