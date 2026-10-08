#!/usr/bin/env node
/**
 * Relata um bug de teste pelo widget <CentralDeBugs>, num navegador que o dev
 * VÊ, e imprime o relato como o simulador o recebeu (descrição, extra, token).
 *
 *   node relatar-teste.mjs --url http://localhost:5173 [--simulador http://localhost:4545]
 *                          [--texto "…"] [--espera-login 300] [--de <pasta>] [--manter-aberto]
 *                          [--estado <storageState.json>] [--sem-janela]
 *                          [--visual <pasta>] [--classe-escuro dark] [--so-visual]
 *
 * Por que um navegador VISÍVEL por padrão: o login é de cada SaaS (senha, SSO,
 * código por e-mail). Em vez de adivinhar o fluxo, o script abre a página,
 * espera o dev entrar e só começa quando o botão da Central de Bugs aparece —
 * que é também a prova de que o widget montou e de que /estado respondeu.
 * Se o repositório já tem uma sessão salva pelos testes e2e dele (o
 * `storageState` do Playwright), `--estado` a reaproveita e `--sem-janela`
 * dispensa o navegador visível.
 *
 * O Playwright é o do PRÓPRIO repositório do SaaS (resolvido a partir de --de,
 * ou do diretório atual). O script não instala nada.
 *
 * Seletores: só as classes do widget (`.cdb-*`) e papéis ARIA, nunca os textos —
 * o SaaS pode trocar todos os textos pela prop `textos`.
 *
 * VISUAL (--visual). Antes de preencher, tira prints do botão e do formulário
 * aberto e mede o contraste (WCAG) dos pares de cor que o widget usa, com as
 * cores JÁ RESOLVIDAS pelo navegador — inclusive quando o `tema` aponta para
 * variáveis do SaaS (`hsl(var(--primary))`). Com --classe-escuro, alterna essa
 * classe no <html> e repete no outro esquema. --so-visual para aí, sem enviar.
 *
 * Saída: o JSON do relato novo no stdout; o andamento no stderr.
 * Códigos: 0 ok · 1 falhou (com --so-visual: algum contraste abaixo do mínimo)
 *          · 2 uso errado · 3 sem Playwright no repositório.
 */
import { createRequire } from 'node:module'
import path from 'node:path'

const AJUDA = `Uso: node relatar-teste.mjs --url <url do SaaS> [opções]

  --url <url>            a página do SaaS rodando localmente (ex.: http://localhost:5173)
  --simulador <url>      o simulador da Central (padrão http://localhost:4545)
  --texto <texto>        o "O que aconteceu?" do relato de teste
  --espera-login <s>     quanto esperar o dev entrar e o botão aparecer (padrão 300)
  --de <pasta>           de onde resolver o Playwright (padrão: diretório atual)
  --manter-aberto        não fecha o navegador no fim
  --estado <arquivo>     storageState do Playwright com uma sessão já logada no SaaS
  --sem-janela           navegador headless (só faz sentido com --estado ou sem login)
  --visual <pasta>       grava prints do widget nessa pasta e mede o contraste das cores
  --classe-escuro <cls>  com --visual: a classe que liga o modo escuro do SaaS no <html> (ex.: dark)
  --so-visual            com --visual: confere o visual e para, sem enviar relato
`

function lerArgs(argv) {
  const opcoes = {
    url: null,
    simulador: 'http://localhost:4545',
    texto: 'Teste da instalação da Central de Bugs: ao salvar, a tela não mostrou a confirmação.',
    esperaLogin: 300,
    de: process.cwd(),
    manterAberto: false,
    estado: null,
    semJanela: false,
    visual: null,
    classeEscuro: null,
    soVisual: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const valor = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new Error(`${arg} precisa de um valor`)
      return v
    }
    if (arg === '--url') opcoes.url = valor()
    else if (arg === '--simulador') opcoes.simulador = valor().replace(/\/+$/, '')
    else if (arg === '--texto') opcoes.texto = valor()
    else if (arg === '--espera-login') opcoes.esperaLogin = Number(valor())
    else if (arg === '--de') opcoes.de = path.resolve(valor())
    else if (arg === '--manter-aberto') opcoes.manterAberto = true
    else if (arg === '--estado') opcoes.estado = path.resolve(valor())
    else if (arg === '--sem-janela') opcoes.semJanela = true
    else if (arg === '--visual') opcoes.visual = path.resolve(valor())
    else if (arg === '--classe-escuro') opcoes.classeEscuro = valor()
    else if (arg === '--so-visual') opcoes.soVisual = true
    else if (arg === '--ajuda' || arg === '--help' || arg === '-h') { process.stdout.write(AJUDA); process.exit(0) }
    else throw new Error(`Opção desconhecida: ${arg}`)
  }
  if (!opcoes.url) throw new Error('Falta --url')
  if ((opcoes.classeEscuro || opcoes.soVisual) && !opcoes.visual) throw new Error('--classe-escuro e --so-visual pedem --visual <pasta>')
  if (!Number.isFinite(opcoes.esperaLogin) || opcoes.esperaLogin <= 0) throw new Error('--espera-login precisa ser um número de segundos')
  // O formulário recusa menos de 15 caracteres no texto principal.
  if (opcoes.texto.trim().length < 15) throw new Error('--texto precisa de pelo menos 15 caracteres')
  return opcoes
}

/** O chromium do Playwright do repositório do SaaS, ou null. */
function chromiumDoRepositorio(de) {
  const requerer = createRequire(path.join(de, 'package.json'))
  for (const nome of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      const modulo = requerer(nome)
      if (modulo?.chromium) return { chromium: modulo.chromium, nome }
    } catch {
      // tenta o próximo
    }
  }
  return null
}

async function relatosDoSimulador(simulador) {
  const resposta = await fetch(`${simulador}/painel/api/relatos`, { cache: 'no-store' })
  if (!resposta.ok) throw new Error(`o simulador respondeu ${resposta.status} em /painel/api/relatos`)
  const corpo = await resposta.json()
  return Array.isArray(corpo?.data) ? corpo.data : []
}

const log = (texto) => process.stderr.write(`${texto}\n`)

/**
 * Os pares de cor do widget, com o mínimo WCAG de cada um. As cores são lidas
 * de uma sonda dentro de `.cdb-raiz` (onde as `--cdb-*` valem) e convertidas
 * para sRGB por um canvas, que entende hsl, oklch, color-mix etc. Cor com
 * transparência é composta sobre a superfície, como aparece na tela.
 */
const PARES = [
  ['texto', 'superficie', 4.5, 'texto principal'],
  ['texto-2', 'superficie', 4.5, 'texto secundário'],
  ['apagado', 'superficie', 3, 'dicas e placeholders'],
  ['texto-no-acento', 'acento', 4.5, 'botão principal'],
  ['acento', 'superficie', 3, 'foco e seleção'],
  ['perigo', 'superficie', 3, 'erros'],
]

async function medirContraste(pagina) {
  return pagina.evaluate((pares) => {
    const raiz = document.querySelector('.cdb-raiz')
    if (!raiz) return { erro: 'sem .cdb-raiz na página' }
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const sonda = document.createElement('span')
    raiz.appendChild(sonda)
    const rgb = (variavel, fundo) => {
      // Fallback magenta: variável inexistente apareceria como #ff00ff, e não herdaria a cor do pai.
      sonda.style.color = `var(--cdb-${variavel}, #ff00ff)`
      const cor = getComputedStyle(sonda).color
      ctx.fillStyle = fundo ? `rgb(${fundo.join(',')})` : '#fff'
      ctx.fillRect(0, 0, 1, 1)
      ctx.fillStyle = cor
      ctx.fillRect(0, 0, 1, 1)
      return { cor, rgb: Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)) }
    }
    const lum = ([r, g, b]) => {
      const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const razao = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
    const superficie = rgb('superficie').rgb
    const saida = pares.map(([frente, fundo, minimo, uso]) => {
      const f = rgb(fundo, fundo === 'superficie' ? null : superficie).rgb
      const t = rgb(frente, f)
      const r = Math.round(razao(t.rgb, f) * 100) / 100
      return { par: `${frente} × ${fundo}`, uso, razao: r, minimo, ok: r >= minimo }
    })
    sonda.remove()
    return { esquema: matchMedia('(prefers-color-scheme: dark)').matches ? 'sistema escuro' : 'sistema claro', pares: saida }
  }, PARES)
}

function logContraste(rotulo, medida) {
  if (medida.erro) { log(`! ${rotulo}: ${medida.erro}`); return }
  log(`  ${rotulo}:`)
  for (const p of medida.pares) log(`    ${p.ok ? '✓' : '✗'} ${p.uso.padEnd(22)} ${p.par.padEnd(30)} ${p.razao.toFixed(2)} (mínimo ${p.minimo})`)
}

/** Prints e contraste do widget aberto; com classe de escuro, repete no outro esquema e devolve a página como estava. */
async function conferirVisual(pagina, opcoes) {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(opcoes.visual, { recursive: true })
  const arquivo = (nome) => path.join(opcoes.visual, nome)
  const visual = { prints: [], medidas: {} }

  await pagina.waitForTimeout(400) // a animação de entrada do diálogo
  await pagina.screenshot({ path: arquivo('widget-aberto.png') })
  visual.prints.push(arquivo('widget-aberto.png'))
  visual.medidas.atual = await medirContraste(pagina)
  log('→ Visual do widget (cores resolvidas no navegador):')
  logContraste('esquema atual da página', visual.medidas.atual)

  if (opcoes.classeEscuro) {
    const classe = opcoes.classeEscuro
    const ligou = await pagina.evaluate((c) => document.documentElement.classList.toggle(c), classe)
    await pagina.waitForTimeout(300)
    const nome = ligou ? 'widget-aberto-escuro.png' : 'widget-aberto-claro.png'
    await pagina.screenshot({ path: arquivo(nome) })
    visual.prints.push(arquivo(nome))
    visual.medidas.alternado = await medirContraste(pagina)
    logContraste(`com a classe "${classe}" ${ligou ? 'ligada' : 'desligada'} no <html>`, visual.medidas.alternado)
    await pagina.evaluate((c) => document.documentElement.classList.toggle(c), classe)
  }

  // O botão flutuante sobre a página, com o formulário fechado.
  await pagina.keyboard.press('Escape')
  await pagina.locator('.cdb-raiz form').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {})
  await pagina.screenshot({ path: arquivo('botao.png') })
  visual.prints.push(arquivo('botao.png'))
  log(`  prints: ${visual.prints.join(', ')}`)
  return visual
}

async function main() {
  let opcoes
  try {
    opcoes = lerArgs(process.argv.slice(2))
  } catch (erro) {
    process.stderr.write(`✗ ${erro.message}\n\n${AJUDA}`)
    return 2
  }

  const playwright = chromiumDoRepositorio(opcoes.de)
  if (!playwright) {
    log(`✗ Não há Playwright em ${opcoes.de} (procurei playwright, @playwright/test e playwright-core).`)
    log('  Sem ele, o relato de teste é feito à mão: abra o SaaS, clique no botão da Central de Bugs e envie um bug.')
    return 3
  }

  let antes
  try {
    antes = new Set((await relatosDoSimulador(opcoes.simulador)).map((r) => r.id))
  } catch (erro) {
    log(`✗ Não consegui falar com o simulador em ${opcoes.simulador}: ${erro.message}`)
    log('  Suba-o antes: npx central-de-bugs simular --env <arquivo .env do servidor>')
    return 1
  }

  let navegador
  try {
    navegador = await playwright.chromium.launch({ headless: opcoes.semJanela })
  } catch (erro) {
    log(`✗ O Chromium do Playwright (${playwright.nome}) não abriu: ${erro.message.split('\n')[0]}`)
    log('  Se faltar o navegador: npx playwright install chromium')
    return 1
  }

  try {
    const contexto = await navegador.newContext(opcoes.estado ? { storageState: opcoes.estado } : {})
    const pagina = await contexto.newPage()
    const errosDoConsole = []
    pagina.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[central-de-bugs]')) errosDoConsole.push(m.text()) })
    await pagina.goto(opcoes.url)

    log(opcoes.semJanela
      ? `→ Abri ${opcoes.url} sem janela${opcoes.estado ? ', com a sessão salva' : ''}.`
      : `→ Abri ${opcoes.url}. Se o SaaS pedir login, entre no navegador que abriu.`)
    log(`  Espero até ${opcoes.esperaLogin}s o botão da Central de Bugs aparecer…`)
    const botao = pagina.locator('button.cdb-fab')
    try {
      await botao.waitFor({ state: 'visible', timeout: opcoes.esperaLogin * 1000 })
    } catch {
      log('✗ O botão da Central de Bugs não apareceu. Causas comuns:')
      log('  - a rota do token respondeu 401/503 (veja o log do servidor do SaaS);')
      log('  - /estado falhou: conexão ou URL da Central erradas no front (VITE_CENTRAL_DE_BUGS_*);')
      log('  - o <CentralDeBugs> não está montado nesta tela.')
      for (const aviso of errosDoConsole) log(`  console: ${aviso}`)
      return 1
    }

    log('→ Botão encontrado. Abrindo o formulário…')
    await botao.click()
    const formulario = pagina.locator('.cdb-raiz form')
    await formulario.waitFor({ state: 'visible', timeout: 20_000 })

    let visual = null
    if (opcoes.visual) {
      visual = await conferirVisual(pagina, opcoes)
      if (opcoes.soVisual) {
        process.stdout.write(`${JSON.stringify({ visual }, null, 2)}\n`)
        return visual.medidas.atual.pares?.every((p) => p.ok) && (visual.medidas.alternado?.pares ?? []).every((p) => p.ok) ? 0 : 1
      }
      await botao.click()
      await formulario.waitFor({ state: 'visible', timeout: 20_000 })
    }

    // Tipo: o primeiro do seletor é sempre o bug (a ordem vem do contrato).
    const tipos = formulario.getByRole('radiogroup').filter({ has: pagina.locator('.cdb-seg__item') })
    if (await tipos.count()) await tipos.first().getByRole('radio').first().click()

    await formulario.locator('textarea.cdb-input--grande').fill(opcoes.texto)
    // Escala: a SEGUNDA opção ("atrapalha"), nunca a primeira — "travado" dispara o
    // aviso urgente ao responsável quando o mesmo teste roda contra a Central real.
    await formulario.locator('.cdb-pills').first().getByRole('radio').nth(1).click()
    await formulario.locator('button[type="submit"]').click()

    const confirmacao = pagina.locator('.cdb-raiz .cdb-confirmacao')
    try {
      await confirmacao.waitFor({ state: 'visible', timeout: 30_000 })
    } catch {
      const erros = await pagina.locator('.cdb-raiz .cdb-erro').allInnerTexts()
      if (erros.length) {
        log('! O formulário pediu mais do que o teste preenche (provavelmente uma pergunta obrigatória do SaaS):')
        for (const e of erros) log(`  - ${e}`)
        log('  Complete no navegador e envie; espero mais 3 minutos.')
        await confirmacao.waitFor({ state: 'visible', timeout: 180_000 })
      } else {
        throw new Error('o envio não terminou em 30s e o formulário não mostrou erro de campo')
      }
    }
    log(`✓ ${(await confirmacao.locator('.cdb-confirmacao__titulo').innerText()).trim()}`)

    const novos = (await relatosDoSimulador(opcoes.simulador)).filter((r) => !antes.has(r.id) && r.estado !== 'rascunho')
    if (!novos.length) {
      log('✗ O widget confirmou, mas o simulador não tem relato novo enviado. O front aponta para outra Central?')
      return 1
    }
    const r = novos[0]
    process.stdout.write(`${JSON.stringify({
      numero: r.numero,
      tipo: r.tipo,
      estado: r.estado,
      titulo: r.titulo,
      autor: r.autor,
      token: r.token,
      extra: r.extra,
      anexos: r.anexos.map((a) => ({ nome: a.nome, mime: a.mime, tamanhoBytes: a.tamanhoBytes })),
      descricao: r.descricao,
      avisosDoWidget: errosDoConsole,
      ...(visual ? { visual } : {}),
    }, null, 2)}\n`)
    return 0
  } catch (erro) {
    log(`✗ ${erro.message.split('\n')[0]}`)
    return 1
  } finally {
    if (opcoes.manterAberto) log('(navegador mantido aberto: feche-o quando terminar)')
    else await navegador.close().catch(() => {})
  }
}

process.exitCode = await main()
