// Drives the app through its setup flow in headless Chrome and screenshots each screen,
// then checks the planner's season grid, the "why" panel, Ctrl K search and Manami's panel.
const puppeteer = require('puppeteer-core');
const path = require('path');
const OUT = path.join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });

const W = +(process.env.W || process.env.E2E_W || 1280), H = +(process.env.H || process.env.E2E_H || 832);
const tag = process.env.TAG || 'd';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = (ok, msg) => console.log(ok ? '✓' : '✗', msg);

async function clickText(page, text, sel = 'button') {
  const ok = await page.evaluate((text, sel) => {
    const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().toLowerCase().startsWith(text.toLowerCase()));
    if (!el) return false;
    el.click();
    return true;
  }, text, sel);
  if (!ok) throw new Error('No button ' + text);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: [`--window-size=${W},${H}`],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
  const logs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !/CORS|ERR_FAILED|net::|Failed to load resource/.test(m.text()) && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  const shot = async (name, wait = 600) => {
    await sleep(wait);
    await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
    console.log('shot', name, page.url().split('#')[1] || '/');
  };
  const scrollMain = (y) => page.evaluate((y) => document.querySelector('.shell__content')?.scrollTo(0, y), y);

  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await shot('01-login');
  await page.type('input[autocomplete=username]', 'Ahmed');
  await clickText(page, 'Sign in');
  await shot('02-experience', 1000);
  result(page.url().endsWith('#/experience'), 'signing in starts setup at About you');
  await clickText(page, 'New farmer');
  await shot('03-your-farm', 1000);
  await clickText(page, 'Continue to farm map');
  await shot('04-farm-map', 1500);
  await clickText(page, 'Load demo farm');
  await shot('05-farm-map-demo', 2500);
  await clickText(page, 'Soil check');
  await shot('06-soil-check-running', 1200);
  for (let i = 0; i < 120; i++) {
    if (await page.evaluate(() => ![...document.querySelectorAll('button')].some((b) => /checking soil/i.test(b.textContent)))) break;
    await sleep(1000);
  }
  await shot('07-soil-check', 1200);
  if (await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /keep old paddocks/i.test(b.textContent)))) {
    await clickText(page, 'Keep old paddocks');
    await shot('08-keep-why', 600);
    await page.type('.modal textarea', 'We just re-fenced these paddocks last year.');
    await page.evaluate(() => [...document.querySelectorAll('.modal__footer button')].find((b) => /keep old/i.test(b.textContent)).click());
  } else {
    await clickText(page, (await page.evaluate(() => [...document.querySelectorAll('.page__actions button')].map((b) => b.textContent.trim()).find((t) => /continue|skip/i.test(t)))) || 'Continue');
  }
  await shot('09-history', 3000);
  result(/\/paddocks\/[^/]+\/history$/.test(page.url()), 'the soil check leads on to the first paddock’s history');
  await scrollMain(99999);
  await shot('10-history-bottom', 600);
  // fill history
  await page.evaluate(() => {
    const sel = document.querySelectorAll('.history-row select');
    const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set(sel[0], 'wheat'); set(sel[1], 'wheat'); set(sel[2], 'canola');
  });
  const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')).paddocks[0].history);
  result(hist.last[0] === 'wheat' && hist.prev2[0] === 'canola', `crop history saves as you choose (${JSON.stringify(hist)})`);
  await scrollMain(0);
  await clickText(page, 'Next: Priorities');
  await shot('11-priorities', 1200);
  // jump to the last paddock and finish
  const lastId = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')).paddocks.at(-1).id);
  await page.goto(BASE + `#/paddocks/${lastId}/priorities`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await clickText(page, 'Done: see my plan');
  await shot('12-planner', 3500);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('sheeep:v1')));
  result(st.setupDone && !(await page.$('.stepper')) && !(await page.$('.side__setup')), 'reaching the plan finishes setup (stepper and checklist hidden)');

  // season grid: keys move the selected column, clicking a heading selects it
  const selected = () => page.evaluate(() => [...document.querySelectorAll('.rotation thead th')].findIndex((th) => th.classList.contains('is-selected')) - 1);
  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await sleep(200);
  result((await selected()) === 3, `→ → → selects the fourth season (index ${await selected()})`);
  await page.evaluate(() => [...document.querySelectorAll('.rotation__season')].at(-1).click());
  await sleep(300);
  const sub = await page.evaluate(() => document.querySelector('.plan-card .card__subtitle')?.textContent);
  result((await selected()) === 9, `clicking the last season heading selects it (${sub})`);
  const cells = await page.evaluate(() => document.querySelectorAll('.rotation-cell').length);
  result(cells === 40, `the grid has a cell per paddock and season (${cells})`);
  await page.evaluate(() => document.querySelector('.rotation tbody tr .rotation-cell').click());
  await sleep(500);
  const drawer = await page.evaluate(() => ({ title: document.querySelector('.drawer__title')?.textContent, ranking: document.querySelectorAll('.ranking li').length }));
  result(!!drawer.title && drawer.ranking > 1, `clicking a cell explains it: “${drawer.title}”, ${drawer.ranking} options ranked`);
  await shot('13-planner-why', 400);
  await page.keyboard.press('Escape');
  await sleep(300);

  // Ctrl K search
  await page.keyboard.down('Control');
  await page.keyboard.press('k');
  await page.keyboard.up('Control');
  await sleep(300);
  await page.keyboard.type('insights');
  await sleep(200);
  await shot('14-search', 200);
  await page.keyboard.press('Enter');
  await sleep(1200);
  result(page.url().endsWith('#/insights'), 'Ctrl K → “insights” → Enter opens Insights');

  // Manami's panel
  await page.evaluate(() => document.querySelector('.top__manami').click());
  await sleep(500);
  await page.type('#manami-input', 'why legumes after wheat?');
  await page.keyboard.press('Enter');
  await sleep(2000);
  const answer = await page.evaluate(() => [...document.querySelectorAll('.bubble--bot')].at(-1)?.textContent || '');
  result(/nitrogen/i.test(answer), `Manami answers in the side panel (“${answer.slice(0, 60)}…”)`);
  await shot('15-manami', 200);
  await page.goto(BASE + '#/dashboard', { waitUntil: 'networkidle2' });
  await shot('16-dashboard', 2500);
  console.log(logs.join('\n') || 'no console errors');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
