// Checks that every screen fits the window: the page itself never scrolls (the app shell
// scrolls its content area instead) and nothing is wider than the window.
//   node measure-fit.mjs [width] [height]      (default: a 1280×665 laptop window)
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +(process.argv[2] || process.env.E2E_W || 1280), H = +(process.argv[3] || process.env.E2E_H || 665);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', userDataDir: './chrome-profile' });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, isMobile: W < 700, hasTouch: W < 700 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
let st = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1') || 'null'));
if (!st?.paddocks?.length) {
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /try the demo/i.test(b.textContent)).click());
  await sleep(1500);
  st = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')));
}
const id = st.paddocks[0].id;
const routes = ['#/', '#/dashboard', '#/experience', '#/farm', '#/paddocks', '#/paddocks/review', '#/register', `#/paddocks/${id}`, `#/paddocks/${id}/history`, `#/paddocks/${id}/conditions`, `#/paddocks/${id}/priorities`, '#/planner', '#/insights', '#/settings'];
for (const r of routes) {
  await page.goto('http://localhost:5173/' + r, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const m = await page.evaluate(() => {
    const main = document.querySelector('.shell__content, .auth');
    return {
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      wide: Math.max(document.documentElement.scrollWidth, main?.scrollWidth || 0) - innerWidth,
      inner: main ? main.scrollHeight - main.clientHeight : 0,
      hash: location.hash,
    };
  });
  const name = m.hash.replace(/\/p[a-z]*\d[a-z0-9]*(\/|$)/, '/:id$1') || '#/';
  console.log(m.pageScroll <= 2 && m.wide <= 1 ? '✓' : '✗', `${W}×${H} ${name.padEnd(26)} page scroll ${m.pageScroll}px · too wide by ${Math.max(0, m.wide)}px${m.inner > 2 ? ` · content scrolls ${m.inner}px inside` : ''}`);
}
await browser.close();
