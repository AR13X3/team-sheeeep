import puppeteer from 'puppeteer-core';
import pc from 'polygon-clipping';
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
const res = (ok, m) => console.log(ok ? '✓' : '✗', m);
const btn = (t) => page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase().startsWith(t.toLowerCase())).click(), t);
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')));
const px = (ll) => page.evaluate(([la, lo]) => { const m = window.__paddockMap; const p = m.latLngToContainerPoint([la, lo]); const c = m.getContainer(); const r = c.getBoundingClientRect(); const k = r.width / c.offsetWidth; /* page zoom */ return { x: r.x + p.x * k, y: r.y + p.y * k }; }, ll);
const view = async (c, z) => { await page.evaluate(([c, z]) => window.__paddockMap.setView(c, z, { animate: false }), [c, z]); await sleep(350); };
const clickLL = async (ll, dx = 0, dy = 0) => { const p = await px(ll); await page.mouse.move(p.x + dx, p.y + dy); await sleep(60); await page.mouse.click(p.x + dx, p.y + dy); await sleep(120); };
const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const north = (ll, m) => [ll[0] + m / 111320, ll[1]];
const drawText = () => page.evaluate(() => document.querySelector('.draw-bar strong')?.textContent);

await btn('Try the demo farm');
await sleep(1500);
await page.goto('http://localhost:5173/#/paddocks', { waitUntil: 'domcontentloaded' });
await sleep(2000);
const p1 = (await state()).paddocks[0]; // corners: NW, NE, SE, SW
const [NW, NE] = [p1.coords[0], p1.coords[1]];

// a. corner snapping: clicks a few px off Paddock #1's corners land exactly on them
await view([-34.9335, 147.162], 16);
await btn('Draw paddock'); await sleep(200);
await clickLL(NW, 6, -4);
await clickLL(NE, -5, 5);
const tipText = await page.evaluate(() => document.querySelector('.snap-tip')?.textContent);
await clickLL(north(NE, 150));
await clickLL(north(NW, 150));
await page.keyboard.press('Enter'); await sleep(500);
let st = await state();
let np = st.paddocks[4];
res(np && np.coords.some((c) => same(c, NW)) && np.coords.some((c) => same(c, NE)), `clicks ~6 px from Paddock #1 corners lock exactly onto them (hover label: "${tipText}")`);
const geo = (c) => [[...c.map(([a, b]) => [b, a]), [c[0][1], c[0][0]]]];
res(np && pc.intersection(geo(np.coords), geo(p1.coords)).length === 0, 'the new paddock shares the edge without overlapping');

// b. tracing: one click on #1's top edge, one on its right edge, and the corner between is filled in
await view([-34.9355, 147.163], 16);
const c1 = (await state()).paddocks[0].coords;
const topMid = [(c1[0][0] + c1[1][0]) / 2, (c1[0][1] + c1[1][1]) / 2];
const rightMid = [(c1[1][0] + c1[2][0]) / 2, (c1[1][1] + c1[2][1]) / 2];
await btn('Draw paddock'); await sleep(200);
await clickLL(topMid, 0, -4);
await clickLL(rightMid, 4, 0);
const traced = await drawText();
res(traced?.startsWith('3'), `two clicks on #1's border trace around its corner: ${traced}`);
await page.keyboard.press('Backspace'); await sleep(150);
const undone = await drawText();
res(undone?.startsWith('1'), `Backspace removes that click and its traced corner together: ${undone}`);
await page.keyboard.press('Escape'); await sleep(200);

// c. Alt: no snapping
await view([-34.9335, 147.162], 16);
await btn('Draw paddock'); await sleep(200);
const pNW = await px(NW);
await page.mouse.move(pNW.x + 6, pNW.y - 4); await sleep(80);
const ringNoAlt = await page.evaluate(() => !!document.querySelector('.snap-tip'));
await page.keyboard.down('Alt'); await page.mouse.move(pNW.x + 7, pNW.y - 4); await sleep(350);
const ringAlt = await page.evaluate(() => !!document.querySelector('.snap-tip'));
console.log('  debug alt:', await page.evaluate(() => [...document.querySelectorAll('.snap-tip')].map(t => t.textContent + ' @' + t.closest('.leaflet-pane')?.className).join(' / ')));
await page.mouse.click(pNW.x + 7, pNW.y - 4); await page.keyboard.up('Alt'); await sleep(150);
res(ringNoAlt && !ringAlt, `snap ring shows near a corner (${ringNoAlt}) and disappears while Alt is held (${!ringAlt})`);
await page.keyboard.press('Escape'); await sleep(200);

// d. the snap distance follows the zoom: a point 25 m from Paddock #2's west edge
const c2 = (await state()).paddocks[1].coords;
const westMid = [(c2[0][0] + c2[3][0]) / 2, (c2[0][1] + c2[3][1]) / 2];
const gap = [westMid[0], westMid[1] - 25 / (111320 * Math.cos((34.94 * Math.PI) / 180))];
for (const z of [14, 16, 18]) {
  await view(gap, z);
  await btn('Draw paddock'); await sleep(200);
  const g = await px(gap); await page.mouse.move(g.x, g.y); await sleep(120);
  const snapped = await page.evaluate(() => document.querySelector('.snap-tip')?.textContent || null);
  console.log('·', `zoom ${z}: point 25 m from Paddock #2 ${snapped ? 'snaps → ' + snapped : 'stays free (gap kept)'}`);
  await page.keyboard.press('Escape'); await sleep(200);
}

// e. overlaps are trimmed (snapping off so the overlap really happens)
await view([-34.936, 147.1645], 16);
await btn('Draw paddock'); await sleep(200);
await page.evaluate(() => document.querySelector('.editor__panel-foot .switch').click()); await sleep(100);
for (const ll of [[-34.9350, 147.1630], [-34.9350, 147.1655], [-34.9370, 147.1655], [-34.9370, 147.1630]]) await clickLL(ll);
console.log('  debug draw before Enter:', await drawText(), '| active:', await page.evaluate(() => document.activeElement?.className));
await page.keyboard.press('Enter'); await sleep(600);
console.log('  debug drawing still?', !!(await drawText()));
const msg = await page.evaluate(() => [...document.querySelectorAll('.map-status .map-chip:not(.paddock-chip)')].map((c) => c.textContent).join(' | '));
st = await state();
const added = st.paddocks[st.paddocks.length - 1];
const left = pc.intersection(geo(added.coords), geo(st.paddocks[0].coords)).flat(2).length;
res(/Trimmed .* ha that overlapped Paddock #1/.test(msg) && left === 0, `overlap trimmed: "${msg}" (remaining overlap: ${left ? 'yes' : 'none'})`);

// f. dragging Paddock #4's corner near Paddock #1's corner locks it on exactly
await page.evaluate(() => [...document.querySelectorAll('.paddock-chip__name')][3].click()); await sleep(900);
await btn('Edit shape'); await sleep(400);
const snapOn = await page.evaluate(() => document.querySelector('.editor__panel-foot .switch')?.getAttribute('aria-checked'));
console.log('· snap switch visible while editing, currently', snapOn === 'true' ? 'on' : 'off', '→ turning it on');
if (snapOn !== 'true') await page.evaluate(() => document.querySelector('.editor__panel-foot .switch').click());
await sleep(200);
const s0 = await state();
const target = s0.paddocks[0].coords[2];
await view(target, 17);
const tp = await px(target), hp = await px(s0.paddocks[3].coords[0]);
await page.mouse.move(hp.x, hp.y); await page.mouse.down();
for (let i = 1; i <= 10; i++) { await page.mouse.move(hp.x + ((tp.x + 4 - hp.x) * i) / 10, hp.y + ((tp.y + 3 - hp.y) * i) / 10); await sleep(20); }
await page.mouse.up(); await sleep(500);
res(same((await state()).paddocks[3].coords[0], target), 'dragging a corner to within a few px of a neighbour corner locks onto it exactly');
console.log(errors.length ? 'errors:\n' + errors.join('\n') : 'no page errors');
await view([-34.936, 147.164], 16);
await page.screenshot({ path: 'shots/snap-final.png' });
await browser.close();
