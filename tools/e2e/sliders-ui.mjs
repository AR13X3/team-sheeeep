import puppeteer from 'puppeteer-core';
import { fileURLToPath as __f } from 'node:url';
import { mkdirSync as __mk } from 'node:fs';
process.chdir(__f(new URL('.', import.meta.url)));
__mk('shots', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: +(process.env.E2E_W || 1280), height: +(process.env.E2E_H || 832) }); // E2E_H=665 tests a laptop window
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /try the demo/i.test(b.textContent)).click());
await sleep(800);
const id = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')).paddocks[0].id);
await page.goto(`http://localhost:5173/#/paddocks/${id}/priorities`, { waitUntil: 'networkidle2' });
await sleep(1500);
const res = (ok, m) => console.log(ok ? '✓' : '✗', m);
const stored = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem('sheeep:v1')).paddocks[0].priorities[k], k);
const sl = async (label) => page.evaluateHandle((l) => document.querySelector(`.slider[aria-label="${l}"]`), label);
const info = (label) => page.evaluate((l) => { const s = document.querySelector(`.slider[aria-label="${l}"]`); s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); const h = s.querySelector('.slider__handle').getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width, now: +s.getAttribute('aria-valuenow'), text: s.getAttribute('aria-valuetext'), handleX: h.x + h.width / 2 - r.x }; }, label);
const preview = () => page.evaluate(() => [...document.querySelectorAll('.plan-preview li')].map((l) => l.textContent).join(' → '));

let i = await info('Profit');
res(i.now === 50 && i.text === 'Medium' && (await stored('profit')) === 50, `starts at 50 "${i.text}"`);
for (const f of [0.25, 0.8, 0.0, 0.997, 0.52]) {
  await page.mouse.click(i.x + i.w * f, i.y);
  await sleep(150);
  const j = await info('Profit');
  const want = Math.round((f * 100) / 5) * 5;
  res(j.now === want && (await stored('profit')) === want && Math.abs(j.handleX - (j.w * want) / 100) < 3, `click at ${f * 100}% → ${j.now} (want ${want}), handle at ${(100 * j.handleX / j.w).toFixed(1)}%, "${j.text}"`);
}
// drag
await page.mouse.move(i.x + i.w * 0.1, i.y); await page.mouse.down(); await page.mouse.move(i.x + i.w * 0.9, i.y, { steps: 10 }); await page.mouse.up(); await sleep(150);
res((await info('Profit')).now === 90, `drag 10% → 90% ends at ${(await info('Profit')).now}`);
// drag past the end clamps
await page.mouse.move(i.x + i.w * 0.5, i.y); await page.mouse.down(); await page.mouse.move(i.x + i.w * 1.4, i.y, { steps: 5 }); await page.mouse.up(); await sleep(150);
res((await info('Profit')).now === 100, `dragging past the end clamps to ${(await info('Profit')).now}`);
// keyboard
await (await sl('Profit')).focus();
const keys = [['Home', 0], ['ArrowRight', 5], ['ArrowUp', 10], ['PageUp', 20], ['End', 100], ['ArrowRight', 100], ['ArrowLeft', 95], ['PageDown', 85]];
for (const [k, want] of keys) { await page.keyboard.press(k); await sleep(80); const n = (await info('Profit')).now; res(n === want, `${k} → ${n} (want ${want})`); }
// levels
for (const [v, word] of [[0, 'Not important'], [20, 'Low'], [50, 'Medium'], [85, 'High'], [100, 'Top priority']]) {
  await page.keyboard.press('Home'); for (let s = 0; s < v / 5; s++) await page.keyboard.press('ArrowRight');
  const j = await info('Profit');
  const shown = await page.evaluate(() => document.querySelectorAll('.priority__level')[2].textContent);
  res(j.text === word && shown === word, `${v} reads "${shown}"`);
}
// preview reacts
await page.keyboard.press('Home'); await sleep(200); const p0 = await preview();
await page.keyboard.press('End'); await sleep(200); const p100 = await preview();
res(p0 !== p100, `preview changes with Profit 0 vs 100:\n     0: ${p0}\n   100: ${p100}`);
console.log(errors.length ? errors.join('\n') : 'no page errors');
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: 'shots/acc-priorities.png' });
await browser.close();
