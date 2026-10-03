// Exports illustrations and icons from the Figma file into src/assets.
//   npm run export:figma            (uses design/TEAM SHEEEEP.fig)
//   npm run export:figma -- path/to/other.fig
// Node IDs below come from the "Game Plan" page. If the design is restructured,
// update the IDs (they're shown in Figma's URL when a layer is selected: node-id=25-1867 -> "25:1867").
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFig } from './fig.mjs';
import { createRenderer } from './render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const figFile = process.argv[2] || path.join(root, 'design', 'TEAM SHEEEEP.fig');
const out = (...p) => path.join(root, 'src', 'assets', ...p);

console.log('Reading', figFile);
const fig = loadFig(figFile);

// Hooks that let CSS animate parts of the artwork (see src/styles/scene.css):
//   fx-sheep / fx-eye / fx-leg / fx-ear  – characters bob, blink, run and flap
//   fx-grass                             – grass layers sway
//   fx-depth (--d)                       – layers that shift with the mouse (parallax)
//   fx-cloud                             – wool clouds drifting across the sky (added, not in Figma)
// Soil also gets plough furrows (added) so the big brown area has some texture.
const isSheep = (n) => n && (/^Sheep \d+$/.test(n.name) || n.name === 'Manami');
const LAYER_PARENTS = new Set(['Footer', 'Pond']);

// A puffy cloud built from circles, like the sheep's wool.
const PUFFS = [[0, 0, 28], [30, -14, 34], [68, -6, 32], [98, 6, 24], [50, 12, 30], [16, 12, 24], [82, 16, 22]];
function cloud(x, y, scale, dur, delay) {
  const circles = (dy, fill, op) => PUFFS.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy + dy}" r="${r}" fill="${fill}" fill-opacity="${op}"/>`).join('');
  return `<g transform="translate(${x} ${y}) scale(${scale})"><g class="fx-cloud" style="--dur:${dur}s;--delay:${delay}s">` +
    circles(7, '#d9b8ac', 0.45) + circles(0, '#f4ede2', 0.92) + '</g></g>';
}

function furrows(n, body, id) {
  const d = body.match(/ d="([^"]+)"/)?.[1];
  if (!d) return body;
  const W = n.size.x, H = Math.min(n.size.y, 680), N = 16; // only the part that's on screen
  let lines = '';
  for (let k = 1; k <= N; k++) {
    const t = k / N;
    const y = 8 + Math.pow(t, 1.55) * (H - 8);
    const sag = 44 * (1 - t) + 6; // follow the curve of the horizon, flatter up close
    const sw = 1 + 3.2 * t;
    const path = (dy) => `M-40 ${(y + sag + dy).toFixed(1)}Q${(W / 2).toFixed(1)} ${(y - sag + dy).toFixed(1)} ${W + 40} ${(y + sag + dy).toFixed(1)}`;
    lines += `<path d="${path(0)}" stroke="#ece4d4" stroke-opacity="${(0.035 + 0.035 * t).toFixed(3)}" stroke-width="${sw.toFixed(1)}" fill="none"/>`;
    lines += `<path d="${path(sw * 1.3)}" stroke="#1c1814" stroke-opacity="0.16" stroke-width="${(sw * 0.8).toFixed(1)}" fill="none"/>`;
  }
  return `${body}<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><g clip-path="url(#${id})">${lines}</g>`;
}

function sceneDecorator({ name = 'art', clouds = [] } = {}) {
  let sheep = 0, grass = 0, furrowId = 0;
  const legCount = new Map();
  const EYES = new Set(['Ellipse 30', 'Ellipse 31', 'Ellipse 4', 'Ellipse 5']);
  return (n, body) => {
    const parent = n._parent;
    let out = body;

    // Character parts (direct children of a sheep): legs (hooves) and ears.
    if (isSheep(parent) && parent.size && n.transform) {
      const pw = parent.size.x, ph = parent.size.y;
      const x = n.transform.m02, y = n.transform.m12;
      if (n.size.y < ph * 0.3 && y > ph * 0.6) {
        const i = legCount.get(parent) || 0;
        legCount.set(parent, i + 1);
        out = `<g class="fx-leg" style="--leg:${i}">${out}</g>`;
      } else if (/^Group \d+$/.test(n.name) && y < ph * 0.3 && n.size.x < pw * 0.4 && (x < pw * 0.15 || x > pw * 0.7)) {
        out = `<g class="fx-ear fx-ear--${x < pw / 2 ? 'l' : 'r'}">${out}</g>`;
      }
    }
    if (isSheep(n)) out = `<g class="fx-sheep" style="--i:${sheep++}">${out}</g>`;
    if (n.name === 'Grass' && n.type === 'BOOLEAN_OPERATION') out = `<g class="fx-grass" style="--i:${grass++}">${out}</g>`;
    if (EYES.has(n.name) && n.size && n.size.x < 16) out = `<g class="fx-eye">${out}</g>`;

    // Plough furrows across the big soil shape.
    const fill = n.fillPaints?.[0]?.color;
    if (parent?.name === 'Footer' && fill && n.size.x > 1000 && n.size.y > 300 && Math.abs(fill.r - 0.275) < 0.02) {
      out = furrows(n, out, `furrows-${name}-${furrowId++}`);
    }

    // Sky: drifting clouds, positioned in frame coordinates.
    if (n.name === 'Sky' && clouds.length && n.transform) {
      const ox = -n.transform.m02, oy = -n.transform.m12;
      out += clouds.map(([x, y, s, dur, delay]) => cloud(x + ox, y + oy, s, dur, delay)).join('');
    }

    // Parallax depth: the sky moves least, the front grass and sheep most.
    if (n.name === 'Sky' && parent?.type === 'FRAME' && !parent._parent?.type?.includes('FRAME')) {
      out = `<g class="fx-depth" style="--d:2">${out}</g>`;
    } else if (LAYER_PARENTS.has(parent?.name)) {
      const idx = parent._kids.indexOf(n), last = Math.max(1, parent._kids.length - 1);
      out = `<g class="fx-depth" style="--d:${(4 + (idx / last) * 12).toFixed(1)}">${out}</g>`;
    }
    return out;
  };
}

// Clouds per scene: [x, y, scale, seconds to cross, start offset] in 1280x832 frame coordinates.
const CLOUDS = {
  meadow: [
    [380, 90, 1.25, 150, -20],
    [900, 190, 0.9, 120, -70],
    [180, 260, 0.7, 170, -110],
    [1050, 70, 1.05, 140, -5],
  ],
  field: [
    [300, 26, 0.55, 110, -30],
    [980, 18, 0.65, 130, -80],
  ],
  'field-paddock': [
    [260, 22, 0.55, 110, -60],
    [1000, 28, 0.6, 130, -15],
  ],
};

function write(file, svg) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, svg);
  console.log('  wrote', path.relative(root, file), `${(svg.length / 1024).toFixed(1)} KB`);
}

// ---- Scenes: full-frame backgrounds with the UI layers stripped out -----------------
const BACKGROUND = /^(Sky|Footer|Pond)$/;
const scenes = {
  meadow: '24:385', // Login
  field: '25:1867', // Experience / Paddocks / Planner
  'field-paddock': '30:4858', // Each Paddock 1 & 2
  pond: '35:5588', // Dashboard
};
for (const [name, id] of Object.entries(scenes)) {
  const r = createRenderer(fig, { idPrefix: `sc-${name}`, decorate: sceneDecorator({ name, clouds: CLOUDS[name] || [] }), include: (k) => BACKGROUND.test(k.name) });
  // overflow="visible" lets the artwork that Figma draws outside the frame bleed onto larger screens.
  write(out('scenes', `${name}.svg`), r.render(id, { attrs: ' overflow="visible" preserveAspectRatio="xMidYMin meet"' }));
}

// ---- Character art -----------------------------------------------------------------
const art = {
  manami: '25:989', // mascot on the login card
  'manami-large': '13:101',
  'sheep-1': '23:180',
  'sheep-2': '23:181',
  'sheep-3': '23:228',
  'sheep-4': '24:283',
  'sheep-5': '30:3674',
  'sheep-6': '30:3724',
};
for (const [name, id] of Object.entries(art)) {
  const r = createRenderer(fig, { idPrefix: `art-${name}`, decorate: sceneDecorator({ name }), transparentRoot: true });
  write(out('art', `${name}.svg`), r.render(id, { attrs: ' overflow="visible"' }));
}

// ---- Icons (Material Symbols used in the design), recoloured with currentColor --------
// Icon masters sit on Figma's internal canvas without computed geometry, so we export
// instances of them (which carry derived geometry) from the screens that use them.
const icons = {
  'arrow-back': '55:580',
  search: '25:3109',
  'arrow-drop-down': '42:11468',
  add: '42:11472',
  check: '39:5894',
  close: '42:10868',
  menu: '67:12356',
};
for (const [name, id] of Object.entries(icons)) {
  const r = createRenderer(fig, { idPrefix: `ic-${name}`, currentColor: true, transparentRoot: true, noEffects: true });
  write(out('icons', `${name}.svg`), r.render(id, { attrs: ' fill="currentColor" aria-hidden="true"' }));
}
console.log('Done.');
