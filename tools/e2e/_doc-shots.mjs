// Refreshes the screenshots in docs/img (light theme, demo farm). Not a check: run it by hand
// with the dev server up:  node tools/e2e/_doc-shots.mjs
// Uses the persistent ./chrome-profile so satellite, weather and soil caches are warm.
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
const OUT = '../../docs/img/';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', userDataDir: './chrome-profile' });
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
const size = (width, height, mobile = false) => page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
const shot = async (name, el) => {
  const target = el ? await page.$(el) : page;
  if (!target) return console.log('✗ missing', el, 'for', name);
  await target.screenshot({ path: `${OUT}${name}.webp`, type: 'webp', quality: 82 });
  console.log('shot', name);
};
const go = async (hash, wait = 1500) => {
  await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
  await sleep(wait);
};
const clickText = (text, sel = 'button') => page.evaluate((t, s) => [...document.querySelectorAll(s)].find((b) => b.textContent.trim().toLowerCase().startsWith(t.toLowerCase()))?.click(), text, sel);
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')));

await size(1280, 800);
await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.evaluate(() => {
  localStorage.removeItem('sheeep:v1');
  localStorage.setItem('sheeep:theme', 'light');
  localStorage.setItem('sheeep:sidebar', 'open');
});
await page.reload({ waitUntil: 'networkidle2' });
await sleep(800);
await shot('login');

// demo farm, then wait for the satellite record and NASA weather
await clickText('Try the demo farm');
await sleep(2000);
for (let i = 0; i < 150 && !(await page.$('.sat-pill.is-ready')); i++) await sleep(1000);
for (let i = 0; i < 90 && (await page.evaluate(() => [...document.querySelectorAll('.sources .badge')].filter((b) => /Connected/.test(b.textContent)).length < 2)); i++) await sleep(1000);
await page.evaluate(() => document.querySelector('.shell__content').scrollTo(0, 0));
for (let i = 0; i < 20 && (await page.$('.toast')); i++) await sleep(500); // let notices close
await sleep(800);
await shot('dashboard');

// tips off for clean pictures, through Settings (Manami gets her own shot)
await go('#/settings', 1200);
await clickText('Experienced');
const ids = (await state()).paddocks.map((p) => p.id);

await go('#/experience');
await shot('experience');
await go('#/farm?back=%2Fsettings');
await shot('your-farm');
await go('#/paddocks', 2500);
await shot('outline');

// snapping: start drawing and hover just off Paddock #1's corner
await clickText('Draw paddock');
await sleep(300);
const c = (await state()).paddocks[0].coords[1];
const p = await page.evaluate(([la, lo]) => { const m = window.__paddockMap; const pt = m.latLngToContainerPoint([la, lo]); const r = m.getContainer().getBoundingClientRect(); return { x: r.x + pt.x, y: r.y + pt.y }; }, c);
await page.mouse.click(p.x - 120, p.y + 40);
await sleep(150);
await page.mouse.move(p.x + 6, p.y - 5);
await sleep(500);
await shot('snapping');
await page.keyboard.press('Escape');

await go('#/paddocks/review', 4000);
for (let i = 0; i < 90 && (await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /checking soil/i.test(b.textContent)))); i++) await sleep(1000);
await sleep(800);
await shot('soil-check');

await go('#/register', 2500);
await shot('register');
await go(`#/paddocks/${ids[1]}`, 3000);
await shot('paddock-overview');
await go(`#/paddocks/${ids[0]}/history`, 3000);
await shot('space-history');
await shot('space-canola', '.space-card');
await page.evaluate(() => document.querySelector('.timelapse').scrollIntoView({ block: 'center' }));
await sleep(1500);
await shot('timelapse', '.timelapse');
await go(`#/paddocks/${ids[0]}/priorities`, 2000);
await shot('priorities');

await go('#/planner', 3500);
await shot('planner');
await page.evaluate(() => document.querySelector('.sowing-card').scrollIntoView({ block: 'center' }));
await sleep(600);
await shot('sowing', '.sowing-card');
await page.evaluate(() => document.querySelector('.shell__content').scrollTo(0, 0));
await page.evaluate(() => document.querySelector('.rotation tbody .rotation-cell').click());
await sleep(800);
await shot('planner-why');
await page.keyboard.press('Escape');
await sleep(300);
await page.click('.crop-set-btn');
await sleep(600);
await shot('your-crops-dialog');
await page.keyboard.press('Escape');

await go('#/insights', 3500);
await shot('insights');
await go('#/settings', 1200);
await clickText('Appearance');
await sleep(300);
await shot('settings');

// search
await go('#/dashboard', 2500);
await page.keyboard.down('Control');
await page.keyboard.press('k');
await page.keyboard.up('Control');
await sleep(300);
await page.keyboard.type('pad');
await sleep(400);
await shot('search');
await page.keyboard.press('Escape');

// Manami with a tip and an answer
await go('#/settings', 1200);
await clickText('New farmer');
await clickText('Reset tips');
await go('#/planner', 3000);
await page.click('.top__manami');
await sleep(500);
await page.type('#manami-input', 'What is blackleg?');
await page.keyboard.press('Enter');
await sleep(2200);
await shot('manami');

// dark theme, with the top bar's own switch
await page.click('.manami__head button[aria-label="Close"]');
await go('#/settings', 1000);
await clickText('Experienced'); // tips off again
await go('#/dashboard', 2500);
await page.click('button[aria-label="Dark mode"]');
await sleep(1200);
await shot('dashboard-dark');
await page.click('button[aria-label="Light mode"]');

// laptop window and phones
await size(1280, 665);
await go('#/planner', 3000);
await shot('planner-laptop');
await size(390, 844, true);
await go('#/paddocks', 3000);
await shot('mobile-outline');
await go('#/planner', 3000);
await shot('mobile-planner');
await browser.close();
