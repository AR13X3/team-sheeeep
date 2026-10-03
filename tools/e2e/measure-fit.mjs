// Checks that no screen makes the whole page scroll (the app zooms to fit the window).
// Long content columns may still scroll inside themselves; those are reported, not failed.
//   node measure-fit.mjs [width] [height]      (default: a 1280×665 laptop window)
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +(process.argv[2] || process.env.E2E_W || 1280), H = +(process.argv[3] || process.env.E2E_H || 665);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', userDataDir: './chrome-profile' });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
const st = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1') || 'null'));
const id = st?.paddocks?.[0]?.id;
const routes = ['#/', '#/experience', '#/farm', '#/paddocks', '#/paddocks/review', `#/paddocks/${id}/history`, `#/paddocks/${id}/priorities`, '#/planner', '#/dashboard'];
for (const r of routes) {
  await page.goto('http://localhost:5173/' + r, { waitUntil: 'domcontentloaded' });
  await sleep(900); // loading screens appear after a short delay
  for (let i = 0; i < 40 && (await page.$('.loading')); i++) await sleep(500);
  await sleep(1200);
  const m = await page.evaluate(() => {
    const doc = document.documentElement.scrollHeight - innerHeight;
    const cols = [...document.querySelectorAll('.scroll-col')].map((c) => c.scrollHeight - c.clientHeight);
    return { pageScroll: doc, innerScroll: cols, hash: location.hash };
  });
  const name = m.hash.replace(/\/p[a-z]*\d[a-z0-9]*\//, '/:id/');
  console.log(m.pageScroll <= 2 ? '✓' : '✗', `${W}×${H} ${name.padEnd(28)} page scroll ${m.pageScroll}px${m.innerScroll.length ? ` · column scrolls ${m.innerScroll.join('/')}px inside` : ''}`);
}
await browser.close();
