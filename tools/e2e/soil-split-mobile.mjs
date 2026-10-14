// Exercises the soil-split branch by seeding the app's soil cache, then checks mobile layouts.
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { splitAcrossLongAxis, centroid } from '../../src/logic/geometry.js';
import { fileURLToPath as __f } from 'node:url';
import { mkdirSync as __mk } from 'node:fs';
process.chdir(__f(new URL('.', import.meta.url)));
__mk('shots', { recursive: true });
const demoSrc = fs.readFileSync('../../src/data/demoFarm.js', 'utf8');
const DEMO_FARM = Function('return ' + demoSrc.slice(demoSrc.indexOf('{', demoSrc.indexOf('DEMO_FARM =')), demoSrc.indexOf('};') + 1))();

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.slice(1)), 'shots');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = 'http://localhost:5173/';

const sg = (ph, clay, sand, silt, soc) => ({
  properties: {
    layers: [
      ['phh2o', ph * 10, 10], ['clay', clay * 10, 10], ['sand', sand * 10, 10], ['silt', silt * 10, 10], ['soc', soc * 10, 10], ['nitrogen', 120, 100],
    ].map(([name, v, f]) => ({ name, unit_measure: { d_factor: f }, depths: ['0-5cm', '5-15cm', '15-30cm'].map((label) => ({ label, values: { mean: v } })) })),
  },
});
const SAME = sg(6.2, 24, 55, 21, 9);
const OTHER = sg(5.1, 38, 30, 32, 14);
const seed = {};
DEMO_FARM.paddocks.forEach((coords, i) => {
  splitAcrossLongAxis(coords).forEach((h, j) => {
    const [lat, lng] = centroid(h);
    seed[`sheeep:cache:soil:${lat.toFixed(4)},${lng.toFixed(4)}`] = JSON.stringify({ t: Date.now(), v: i === 1 && j === 1 ? OTHER : SAME });
  });
  const [lat, lng] = centroid(coords);
  seed[`sheeep:cache:soil:${lat.toFixed(4)},${lng.toFixed(4)}`] = JSON.stringify({ t: Date.now(), v: SAME });
});

async function clickText(page, text) {
  const ok = await page.evaluate((text) => {
    const el = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().toLowerCase().startsWith(text.toLowerCase()));
    el?.click();
    return !!el;
  }, text);
  if (!ok) throw new Error('No button ' + text);
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
const shot = async (name, wait = 600) => {
  await sleep(wait);
  await page.screenshot({ path: path.join(OUT, `s-${name}.png`) });
  console.log('shot', name, page.url());
};

await page.setViewport({ width: +(process.env.E2E_W || 1280), height: +(process.env.E2E_H || 832) }); // E2E_H=665 tests a laptop window
await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.evaluate((seed) => {
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
}, seed);
await page.reload({ waitUntil: 'networkidle2' });
await page.type('input[autocomplete=username]', 'Ahmed');
await clickText(page, 'Sign in');
await sleep(1500);
await clickText(page, 'Experienced farmer');
await sleep(800);
await clickText(page, 'Continue to farm map'); // Your crops: keep every crop
await sleep(800);
await clickText(page, 'Load demo farm');
await sleep(1500);
// Draw an extra paddock with real clicks on the map
await clickText(page, 'Draw paddock');
const box = await page.$eval('.paddock-map', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const P = (fx, fy) => [box.x + box.w * fx, box.y + box.h * fy];
for (const [fx, fy] of [[0.08, 0.2], [0.24, 0.2], [0.24, 0.42], [0.08, 0.42]]) { await page.mouse.click(...P(fx, fy)); await sleep(150); }
await shot('01-drawing', 300);
await page.mouse.click(...P(0.08, 0.2)); // close ring on first corner
await shot('02-drawn', 600);
await page.evaluate(() => document.querySelector('.paddock-chip:last-child .paddock-chip__name').click());
await sleep(300);
await page.evaluate(() => document.querySelector('button[aria-label^="Delete"]').click());
console.log('after delete:', await page.evaluate(() => document.querySelectorAll('.paddock-chip').length));
await sleep(300);
await page.evaluate(() => document.querySelector('.paddock-chip__name').click());
await sleep(900);
await clickText(page, 'Edit shape');
await shot('02b-edit-shape', 900);
await page.evaluate(() => [...document.querySelectorAll('.paddock-chip__actions button')].find((b) => b.textContent.trim() === 'Done').click());
await clickText(page, 'Soil check');
for (let i = 0; i < 40; i++) {
  if (await page.evaluate(() => ![...document.querySelectorAll('button')].some((b) => /checking soil/i.test(b.textContent)))) break;
  await sleep(500);
}
await shot('03-review-split', 1500);
// click a suggested half on the map (paddock #2 B)
await page.evaluate(() => {
  const paths = [...document.querySelectorAll('.paddock-map path.leaflet-interactive')];
  paths[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await shot('04-review-selected', 600);
await clickText(page, 'Accept new paddocks');
await shot('05-history-after-accept', 2500);
await page.evaluate(() => document.querySelector('.shell__content').scrollTo(0, 700));
await shot('06-history-soil-slope', 3000);
const names = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')).paddocks.map((p) => p.name + ':' + (p.site.soil?.texture || '-')));
console.log('paddocks after accept:', names.join(', '));

await page.goto(BASE + '#/planner', { waitUntil: 'domcontentloaded' });
await shot('06b-planner-loading', 700);
await sleep(4000);
await shot('06c-planner', 500);
// Mobile
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await page.goto(BASE + '#/planner', { waitUntil: 'networkidle2' });
await shot('07-m-planner', 2500);
const pid = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')).paddocks[0].id);
await page.goto(BASE + '#/paddocks/' + pid + '/history', { waitUntil: 'networkidle2' });
await page.evaluate(() => document.querySelector('.shell__content').scrollTo(0, 900));
await shot('07b-m-history', 1500);
await page.goto(BASE + '#/paddocks', { waitUntil: 'networkidle2' });
await shot('08-m-outline', 2000);
await page.evaluate(() => { localStorage.removeItem('sheeep:v1'); });
await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.reload({ waitUntil: 'networkidle2' });
await shot('09-m-login', 800);
console.log(logs.join('\n') || 'no console errors');
await browser.close();
