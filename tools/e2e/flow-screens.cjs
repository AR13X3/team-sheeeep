// Drives the app through its flow in headless Chrome and screenshots each screen.
const puppeteer = require('puppeteer-core');
const path = require('path');
const OUT = path.join(__dirname, 'shots');
require('fs').mkdirSync(OUT, { recursive: true });

const W = +(process.env.W || 1280), H = +(process.env.H || 832);
const tag = process.env.TAG || 'd';
const BASE = 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  const shot = async (name, wait = 600) => {
    await sleep(wait);
    await page.screenshot({ path: path.join(OUT, `${tag}-${name}.png`) });
    console.log('shot', name, page.url());
  };

  const only = process.argv[2];
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await shot('01-login');
  await page.type('input[autocomplete=username]', 'Ahmed');
  await clickText(page, 'Login');
  await shot('02-experience');
  await clickText(page, 'New Farmer');
  await shot('02b-your-farm', 800);
  await clickText(page, 'Continue');
  await shot('03-outline', 1500);
  await clickText(page, 'Demo farm');
  await shot('04-outline-demo', 2500);
  await clickText(page, 'Continue');
  await shot('05-review-loading', 900);
  // wait for analysis
  for (let i = 0; i < 90; i++) {
    const done = await page.evaluate(() => !document.body.textContent.includes('Checking the soil'));
    if (done) break;
    await sleep(1000);
  }
  await shot('06-review', 1500);
  const hasAccept = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /keep old paddocks/i.test(b.textContent)));
  if (hasAccept) {
    await clickText(page, 'Keep old paddocks');
    await shot('07-why', 600);
    await page.type('.modal textarea', 'We just re-fenced these paddocks last year.');
    await clickText(page, 'OK');
  } else {
    const label = await page.evaluate(() => [...document.querySelectorAll('.review__actions button')].map((b) => b.textContent.trim()).find((t) => /continue|skip/i.test(t)));
    console.log('review action:', label);
    await clickText(page, label);
  }
  await shot('08-history', 3000);
  await page.evaluate(() => document.querySelector('.scroll-col').scrollTo(0, 99999));
  await shot('09-history-bottom', 600);
  // fill history
  await page.evaluate(() => {
    const sel = document.querySelectorAll('select');
    const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set(sel[0], 'wheat'); set(sel[1], 'wheat'); set(sel[2], 'canola');
  });
  await page.evaluate(() => document.querySelector('.scroll-col').scrollTo(0, 0));
  await shot('10-history-filled', 500);
  await clickText(page, 'Next: Priorities');
  await shot('11-priorities', 1200);
  await page.evaluate(() => document.querySelector('.scroll-col').scrollTo(0, 99999));
  await shot('12-priorities-bottom', 600);
  // jump to planner
  await page.goto(BASE + '#/planner', { waitUntil: 'networkidle2' });
  await shot('13-planner', 4000);
  console.log(await page.evaluate(() => [...document.querySelectorAll('.plan-card')].map(c => c.getBoundingClientRect().height + '/' + c.scrollHeight)));
  // season strip: keyboard, then a click on the last season (it used to be unreachable)
  await page.focus('.season-strip__item.is-selected');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  const afterKeys = await page.evaluate(() => [...document.querySelectorAll('.season-strip__item')].findIndex((b) => b.getAttribute('aria-selected') === 'true'));
  console.log(afterKeys === 3 ? '✓' : '✗', `→ → → selects season 4 (selected index ${afterKeys})`);
  await shot('14-planner-season4', 800);
  await page.click('.season-strip__item:last-child');
  await new Promise((r) => setTimeout(r, 300));
  const last = await page.evaluate(() => ({ sel: document.querySelector('.season-strip__item:last-child').getAttribute('aria-selected'), sub: document.querySelector('.plan-card .muted.small')?.textContent }));
  console.log(last.sel === 'true' ? '✓' : '✗', `clicking the last season selects it (${last.sub})`);
  await page.click('.season-strip__arrow:first-child');
  const back = await page.evaluate(() => [...document.querySelectorAll('.season-strip__item')].findIndex((b) => b.getAttribute('aria-selected') === 'true'));
  console.log(back === 8 ? '✓' : '✗', `previous-season arrow steps back (index ${back})`);
  await page.evaluate(() => document.querySelector('.chatbot__launcher').click());
  await shot('15-chat-open', 600);
  await page.type('.chat__form input', 'why legumes after wheat?');
  await page.keyboard.press('Enter');
  await shot('16-chat-answer', 2000);
  await page.goto(BASE + '#/dashboard', { waitUntil: 'networkidle2' });
  await shot('17-dashboard', 1500);
  console.log(logs.join('\n') || 'no console errors');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
