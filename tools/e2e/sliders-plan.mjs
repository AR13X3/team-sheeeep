import { planPaddock } from '../../src/logic/rotation.js';
import { CROP_BY_ID } from '../../src/data/crops.js';
import { fileURLToPath as __f } from 'node:url';
import { mkdirSync as __mk } from 'node:fs';
process.chdir(__f(new URL('.', import.meta.url)));
__mk('shots', { recursive: true });
const base = { issues: {}, reasons: {}, history: { last: ['wheat'], prev: ['canola'], prev2: ['wheat'] }, site: { soil: { ph: 6.3, soc: 10 }, climate: { rainfallMm: 500 } } };
const histories = [
  { last: ['wheat'], prev: ['canola'], prev2: ['wheat'] },
  { last: ['barley'], prev: ['wheat'], prev2: ['wheat'] },
  { last: ['lupins'], prev: ['wheat'], prev2: ['canola'] },
  { last: [''], prev: [''], prev2: [''] },
];
const metric = { soilHealth: ['soil', +1], water: ['water', -1], profit: ['profit', +1], risk: ['risk', -1] };
const label = { soilHealth: 'Soil Health', water: 'Water Saving', profit: 'Profit', risk: 'Low Risk' };
const avgAttr = (plan, attr) => plan.seasons.reduce((s, x) => s + x.crop[attr], 0) / plan.seasons.length;
console.log('Each slider swept 0→100 (others at 50), averaged over 4 paddock histories.');
console.log('Value = average of the crop attribute that slider should favour, over 10 seasons.\n');
for (const [key, [attr, dir]] of Object.entries(metric)) {
  const row = [];
  for (const v of [0, 25, 50, 75, 100]) {
    let sum = 0;
    for (const h of histories) {
      const pr = { soilHealth: 50, water: 50, profit: 50, risk: 50, [key]: v };
      sum += avgAttr(planPaddock({ ...base, history: h, priorities: pr }, 10), attr);
    }
    row.push(sum / histories.length);
  }
  const monotone = row.every((x, i) => i === 0 || (dir > 0 ? x >= row[i - 1] - 1e-9 : x <= row[i - 1] + 1e-9));
  const change = (row[4] - row[0]) * dir;
  console.log(`${monotone && change > 0 ? '✓' : '✗'} ${label[key].padEnd(13)} avg crop.${attr} at 0/25/50/75/100: ${row.map((x) => x.toFixed(2)).join(' / ')}  ${dir > 0 ? '(should rise)' : '(should fall)'}`);
}
console.log('\nSample plans for the first history:');
for (const [name, pr] of Object.entries({
  'all 50': { soilHealth: 50, water: 50, profit: 50, risk: 50 },
  'Profit 100': { soilHealth: 50, water: 50, profit: 100, risk: 50 },
  'Soil Health 100': { soilHealth: 100, water: 50, profit: 50, risk: 50 },
  'Water Saving 100': { soilHealth: 50, water: 100, profit: 50, risk: 50 },
  'Low Risk 100': { soilHealth: 50, water: 50, profit: 50, risk: 100 },
  'all 0': { soilHealth: 0, water: 0, profit: 0, risk: 0 },
})) {
  const p = planPaddock({ ...base, priorities: pr }, 8);
  console.log(name.padEnd(17), p.seasons.map((s) => s.crop.name).join(' → '), `| soil health ${p.base}→${p.seasons.at(-1).health}`);
}
