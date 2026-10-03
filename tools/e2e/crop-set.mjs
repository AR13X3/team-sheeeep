// The farm's crop list: "Crops only" removes pasture, and the plan only uses ticked crops.
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
mkdirSync('shots', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: +(process.env.E2E_W || 1280), height: +(process.env.E2E_H || 832) });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/CORS|ERR_FAILED|net::|Failed to load resource/.test(m.text()) && errors.push(m.text()));
const result = (ok, msg) => console.log(ok ? '✓' : '✗', msg);
const clickText = (sel, text) => page.evaluate((s, t) => [...document.querySelectorAll(s)].find((b) => b.textContent.trim().startsWith(t))?.click(), sel, text);
const waitLoaded = async () => { await sleep(900); for (let i = 0; i < 40 && (await page.$('.loading')); i++) await sleep(500); await sleep(800); };

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await clickText('button', 'Try the demo farm');
await sleep(1500);

// onboarding: About you → Your Farm
await page.goto('http://localhost:5173/#/experience', { waitUntil: 'domcontentloaded' });
await sleep(800);
await clickText('button', 'New Farmer');
await sleep(800);
result(page.url().endsWith('#/farm'), `“New Farmer” leads to the Your Farm step (${page.url().split('#')[1]})`);
const before = await page.evaluate(() => document.querySelectorAll('.crop-toggle.is-on').length);
result(before === 12, `every crop is ticked by default (${before} of 12, incl. fallow)`);

await clickText('.choice', 'Crops only');
await sleep(200);
const pasture = await page.evaluate(() => { const b = [...document.querySelectorAll('.crop-toggle')].find((x) => x.textContent.includes('Pasture')); return { disabled: b.disabled, on: b.classList.contains('is-on') }; });
result(pasture.disabled && !pasture.on, `“Crops only” switches pasture off (disabled: ${pasture.disabled})`);

await clickText('.crop-set__quick button', 'Clear');
for (const name of ['Wheat', 'Barley', 'Canola', 'Lupins']) await clickText('.crop-toggle', name);
await sleep(200);
const ticked = await page.evaluate(() => [...document.querySelectorAll('.crop-toggle.is-on')].map((b) => b.textContent.trim()));
const warnings = await page.evaluate(() => [...document.querySelectorAll('.crop-set__warn p')].map((p) => p.textContent));
result(ticked.join(',') === 'Wheat,Barley,Canola,Lupins' && !warnings.length, `ticked: ${ticked.join(', ')} · warnings: ${warnings.length}`);
await page.screenshot({ path: 'shots/crop-set-farm.png' });

// planner: every season of every paddock uses only those crops
const allowed = new Set(['Wheat', 'Barley', 'Canola', 'Lupins']);
const planCrops = async () => page.evaluate(() => [...document.querySelectorAll('.season-strip__item')].flatMap((b) => b.getAttribute('aria-label').split('. ')[1].split(', ').map((x) => x.split(': ')[1])));
await clickText('button', 'Continue');
await sleep(500);
result(page.url().endsWith('#/paddocks'), 'Continue goes on to outlining paddocks');
await page.goto('http://localhost:5173/#/planner', { waitUntil: 'domcontentloaded' });
await waitLoaded();
let used = await planCrops();
const outside = [...new Set(used.filter((c) => !allowed.has(c)))];
result(used.length === 40 && !outside.length, `planner uses only the ticked crops across 4 paddocks × 10 seasons (${[...new Set(used)].join(', ')}${outside.length ? ` · outside: ${outside.join(', ')}` : ''})`);
const btn = await page.evaluate(() => document.querySelector('.crop-set-btn')?.textContent.trim());
result(btn === '4 crops · no livestock', `planner shows the crop list: “${btn}”`);

// edit from the planner: add Field Peas, plan updates live
await page.click('.crop-set-btn');
await sleep(400);
await page.screenshot({ path: 'shots/crop-set-modal.png' });
await clickText('.modal .crop-toggle', 'Field Peas');
await clickText('.modal__footer button', 'Done');
await sleep(500);
used = await planCrops();
const btn2 = await page.evaluate(() => document.querySelector('.crop-set-btn')?.textContent.trim());
const newSet = new Set([...allowed, 'Field Peas']);
result(btn2 === '5 crops · no livestock' && used.every((c) => newSet.has(c)) && !(await page.$('.modal')), `editing in the Planner updates the plan (“${btn2}”; peas used: ${used.includes('Field Peas')})`);

// priorities preview follows the same list
const id = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')).paddocks[0].id);
await page.goto(`http://localhost:5173/#/paddocks/${id}/priorities`, { waitUntil: 'domcontentloaded' });
await waitLoaded();
const preview = await page.evaluate(() => [...document.querySelectorAll('.plan-preview li, .plan-preview__item')].map((li) => li.textContent.trim()).filter(Boolean));
result(preview.length > 0 && preview.every((t) => [...newSet].some((c) => t.includes(c))), `Priorities preview only uses the list (${preview.join(' → ')})`);

// a list with no break crop warns
await page.goto('http://localhost:5173/#/farm?back=%2Fplanner', { waitUntil: 'domcontentloaded' });
await sleep(800);
await clickText('.crop-set__quick button', 'Clear');
await clickText('.crop-toggle', 'Wheat');
await sleep(200);
const w2 = await page.evaluate(() => [...document.querySelectorAll('.crop-set__warn p')].map((p) => p.textContent));
result(w2.length === 2 && /break crop/.test(w2[0]), `wheat only → ${w2.length} warnings (“${w2[0]?.slice(0, 40)}…”)`);
await clickText('button', 'Done');
await sleep(400);
result(page.url().endsWith('#/planner'), 'Done returns to where you came from');

console.log(errors.length ? 'errors:\n' + errors.join('\n') : 'no page errors');
await browser.close();
