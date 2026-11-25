// Caixa real (produção) com balança POP-S simulada. Turno falso; escritas bloqueadas.
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { readdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Users/LUCAS ARAGÃO/alia-instagram/package.json')
const { chromium } = require('playwright-core')
const base = homedir() + '/AppData/Local/ms-playwright/chromium-1248/'
const dir = readdirSync(base).find((d) => d.startsWith('chrome-win'))
const [out, url] = process.argv.slice(2)
const env = readFileSync(homedir() + '/.cofre/cofre.env', 'utf8')
const get = (k) => env.match(new RegExp('^' + k + '=["\']?([^"\'\\r\\n]+)', 'm'))[1]
const b = await chromium.launch({ executablePath: base + dir + '/chrome.exe' })
const c = await b.newContext({ viewport: { width: 1366, height: 768 } })
await c.addInitScript(() => {
  window.__escritos = 0
  const mk = () => {
    const p = new EventTarget()
    Object.assign(p, { readable: null, writable: null, getInfo: () => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 }), setSignals: async () => {}, close: async () => {},
      open: async () => {
        p.readable = new ReadableStream({ start(x) { window.__pesa = (kg) => {
          const s = '\x08\x02\x03\x03\x02\x03\x01\x02\x00\x14DATA:  00/00/00 VALID.: 00/00/00      TARA:   0.000kg       PESO L:  ' + kg + 'kg      R$/kg:     49.90      TOTAL R$:      6.8920000000006 89\x03\x09\x02\x01\x03'
          const u = new Uint8Array([...s].map((k) => k.charCodeAt(0)))
          x.enqueue(u.slice(0, 96)); setTimeout(() => x.enqueue(u.slice(96)), 120)
        } } })
        p.writable = new WritableStream({ write() { window.__escritos++ } })
      } })
    return p
  }
  const s = new EventTarget(); s.getPorts = async () => []; s.requestPort = async () => mk()
  Object.defineProperty(navigator, 'serial', { value: s, configurable: true })
})
const p = await c.newPage()
let venda = null
await p.route('**/rest/v1/**', async (rota) => {
  const r = rota.request()
  if (r.method() === 'POST' && /\/sales/.test(r.url())) { venda = r.postDataJSON(); return rota.fulfill({ status: 201, body: '', headers: { 'access-control-allow-origin': '*' } }) }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && !r.url().includes('/rpc/')) return rota.abort()
  if (/\/shifts\?/.test(r.url()) && r.method() === 'GET') {
    const s = { id: '00000000-0000-4000-8000-0000000000aa', location_id: 'x', shift_number: 1, opened_at: new Date().toISOString(), closed_at: null, status: 'open', opened_by: 'x', operator_name: null, total_sales: 0, total_amount: 0, total_pix: 0, total_card: 0, total_cash: 0 }
    return rota.fulfill({ json: (r.headers()['accept'] || '').includes('vnd.pgrst.object') ? s : [s], headers: { 'access-control-allow-origin': '*' } })
  }
  return rota.continue()
})
await p.goto(url + '/login')
await p.fill('input[placeholder="seu@email.com"], input[type=email]', get('IRIS_LOGIN'))
await p.fill('input[type=password]', get('IRIS_SENHA'))
await p.click('button:has-text("Entrar")')
await p.waitForTimeout(4500)
await p.goto(url + '/pos')
await p.waitForTimeout(4500)
const peso = () => p.locator('[aria-label^="Peso"],[aria-label="Aguardando peso"]').first().innerText()
const st = async (r) => console.log(r, '| peso:', await peso(), '| captura habilitada:', await p.locator('button[aria-label="Capturar peso atual da balança"]').isEnabled().catch(() => 'n/a'))
await p.locator('button:has-text("Conectar Balança")').click()
await p.waitForTimeout(1500)
await st('conectada, sem pesar')
await p.evaluate(() => window.__pesa('0.138')); await p.waitForTimeout(500); await st('pesou 0.138')
await p.screenshot({ path: out + '/label-1.png' })
await p.locator('button[aria-label="Capturar peso atual da balança"]').click(); await p.waitForTimeout(300)
console.log('capturado | peso na tela:', await peso(), '|', (await p.locator('body').innerText()).match(/✓ \d+g capturado/)?.[0])
await p.locator('button:has-text("PIX")').first().click()
await p.locator('button:has-text("Confirmar Venda")').click(); await p.waitForTimeout(1500)
console.log('venda enviada:', JSON.stringify(Array.isArray(venda) ? venda[0] : venda, ['weight_grams', 'price_per_gram', 'amount', 'payment_method', 'weight_source']))
await st('depois da venda (não pode reaproveitar)')
await p.evaluate(() => window.__pesa('0.412')); await p.waitForTimeout(500); await st('próximo cliente 0.412')
await p.waitForTimeout(13000)
console.log('13 s calada | conectada:', (await p.locator('body').innerText()).includes('Balança Conectada'), '| escritas na porta:', await p.evaluate(() => window.__escritos))
await p.waitForTimeout(50000); await st('60 s sem capturar')
await b.close()
