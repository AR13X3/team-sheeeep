// Screenshots each screen at a given window size, to check the layout.
//   node _fit-shots.mjs [width] [height]   → shots/fit-<w>x<h>-<screen>.png
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
process.chdir(fileURLToPath(new URL('.', import.meta.url)));
mkdirSync('shots', { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +(process.argv[2] || 1280), H = +(process.argv[3] || 665);
const only = process.argv[4];
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', userDataDir: './chrome-profile' });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
const id = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1') || '{}').paddocks?.[0]?.id);
const screens = { login: '#/', dashboard: '#/dashboard', experience: '#/experience', farm: '#/farm', paddocks: '#/paddocks', review: '#/paddocks/review', register: '#/register', paddock: `#/paddocks/${id}`, history: `#/paddocks/${id}/history`, conditions: `#/paddocks/${id}/conditions`, priorities: `#/paddocks/${id}/priorities`, planner: '#/planner', insights: '#/insights', settings: '#/settings' };
for (const [name, hash] of Object.entries(screens)) {
  if (only && !name.includes(only)) continue;
  await page.goto('http://localhost:5173/' + hash, { waitUntil: 'domcontentloaded' });
  await sleep(900); // loading screens appear after a short delay
  await sleep(1500);
  await page.screenshot({ path: `shots/fit-${W}x${H}-${name}.png` });
}
await browser.close();
