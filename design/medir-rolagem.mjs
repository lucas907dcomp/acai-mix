import { chromium } from 'playwright-core';
const exe = process.env.CHROME;
const b = await chromium.launch({ executablePath: exe });
const out = process.argv[2];
for (const [w,h] of [[1366,768],[1280,720],[1920,1080]]) {
  const p = await b.newPage({ viewport:{ width:w, height:h } });
  await p.goto('http://localhost:5181/login');
  await p.fill('input[type=email], input[placeholder="seu@email.com"]', process.env.U);
  await p.fill('input[type=password]', process.env.S);
  await p.click('button:has-text("Entrar")');
  await p.waitForTimeout(4000);
  await p.goto('http://localhost:5181/pos'); await p.waitForTimeout(3500);
  const m = await p.evaluate(() => ({ url: location.pathname, docH: document.documentElement.scrollHeight, winH: innerHeight,
     scrollers: [...document.querySelectorAll('*')].filter(e => { const s=getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight+1 && e.clientHeight>200; }).map(e => e.className.toString().slice(0,60)) }));
  console.log(w+'x'+h, JSON.stringify(m), m.docH > m.winH ? 'ROLA' : 'SEM ROLAGEM');
  await p.screenshot({ path: `${out}/pos-${w}x${h}.png` });
  await p.close();
}
await b.close();
