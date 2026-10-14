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
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
const click = (text) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase().startsWith(t.toLowerCase())).click(), text);
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')));
const result = (ok, msg) => console.log(ok ? '✓' : '✗', msg);

await click('Try the demo farm');
await sleep(1500);
await page.goto('http://localhost:5173/#/paddocks', { waitUntil: 'domcontentloaded' });
await sleep(2000);
result((await state()).paddocks.length === 4, 'demo farm loads 4 paddocks');

// 1. clicking a paddock (on its label) selects that paddock
for (const n of ['#3', '#1']) {
  const box = await page.evaluate((n) => { const t = [...document.querySelectorAll('.paddock-tag')].find((x) => x.textContent === n); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, n);
  await page.mouse.click(box.x, box.y + 18);
  await sleep(300);
  const sel = await page.evaluate(() => document.querySelector('.paddock-chip.is-selected')?.textContent);
  result(sel?.includes(`Paddock ${n}`), `click inside paddock ${n} selects it (selected: ${sel})`);
}
await click('Draw paddock'); // starts drawing (and clears the selection)
await sleep(300);
const box = await page.$eval('.paddock-map', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const P = (fx, fy) => [box.x + box.w * fx, box.y + box.h * fy];

// 2. Backspace undo while drawing
await page.mouse.click(...P(0.06, 0.25)); await sleep(120);
await page.mouse.click(...P(0.2, 0.25)); await sleep(120);
await page.mouse.click(...P(0.2, 0.45)); await sleep(120);
let corners = await page.evaluate(() => document.querySelector('.draw-bar strong')?.textContent);
await page.keyboard.press('Backspace'); await sleep(150);
let after = await page.evaluate(() => document.querySelector('.draw-bar strong')?.textContent);
result(corners.startsWith('3') && after.startsWith('2'), `Backspace removes a corner (${corners} → ${after})`);

// 3. double-click finishes with exactly the clicked corners
await page.mouse.click(...P(0.2, 0.45)); await sleep(120);
await page.mouse.click(...P(0.06, 0.45), { count: 2 });
await sleep(500);
let st = await state();
const last = st.paddocks[st.paddocks.length - 1];
result(st.paddocks.length === 5 && last.coords.length === 4, `double-click finishes: ${st.paddocks.length} paddocks, new one has ${last.coords.length} corners (want 4)`);

// 4. crossed outline is rejected
await click('Draw paddock'); await sleep(200);
for (const [fx, fy] of [[0.06, 0.6], [0.2, 0.75], [0.2, 0.6], [0.06, 0.75]]) { await page.mouse.click(...P(fx, fy)); await sleep(120); }
await page.keyboard.press('Enter'); await sleep(400);
let hint = await page.evaluate(() => document.querySelector('.map-chip--warn')?.textContent);
st = await state();
result(st.paddocks.length === 5 && /crosses itself/.test(hint || ''), `bow-tie rejected (${st.paddocks.length} paddocks; hint: "${hint}")`);

// 5. mis-click (tiny) is rejected
await click('Draw paddock'); await sleep(200);
for (const [dx, dy] of [[0, 0], [4, 0], [4, 4]]) { const [x, y] = P(0.12, 0.66); await page.mouse.click(x + dx, y + dy); await sleep(120); }
await page.keyboard.press('Enter'); await sleep(400);
hint = await page.evaluate(() => document.querySelector('.map-chip--warn')?.textContent);
st = await state();
result(st.paddocks.length === 5 && /mis-click/.test(hint || ''), `tiny shape rejected (hint: "${hint}")`);

// 6. drag a corner to reshape; site data is reset so it gets re-fetched
await page.evaluate(() => [...document.querySelectorAll('.paddock-chip__name')].pop().click());
await sleep(900);
await click('Edit shape'); await sleep(400);
const before = (await state()).paddocks[4].coords;
const h = await page.evaluate(() => { const r = document.querySelector('.vertex-handle--corner').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x - 30, h.y - 25, { steps: 8 }); await page.mouse.up();
await sleep(500);
const now = (await state()).paddocks[4];
const moved = JSON.stringify(now.coords) !== JSON.stringify(before);
result(moved && JSON.stringify(now.site) === '{}', `dragging a corner reshapes the paddock (moved: ${moved}, site reset: ${JSON.stringify(now.site) === '{}'})`);
const midsBefore = now.coords.length;
await page.evaluate(() => { const m = document.querySelector('.vertex-handle--mid'); m.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
await sleep(400);
result((await state()).paddocks[4].coords.length === midsBefore + 1, `clicking a midpoint adds a corner (${midsBefore} → ${(await state()).paddocks[4].coords.length})`);
// 7. delete shows a toast with Undo, which brings the paddock back
await page.evaluate(() => document.querySelector('button[aria-label^="Delete Paddock"]').click());
await sleep(400);
const afterDelete = (await state()).paddocks.length;
await page.evaluate(() => [...document.querySelectorAll('.toast button')].find((b) => b.textContent.trim() === 'Undo').click());
await sleep(400);
const afterUndo = (await state()).paddocks.length;
result(afterDelete === 4 && afterUndo === 5, `delete then Undo: ${afterDelete} → ${afterUndo} paddocks`);
console.log(errors.length ? 'errors:\n' + errors.join('\n') : 'no page errors');
await browser.close();
