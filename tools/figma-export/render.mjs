// Renders Figma nodes to SVG using the geometry Figma already computed
// (fillGeometry / strokeGeometry / glyph outlines), so boolean ops, strokes and
// text come out exactly as drawn in the editor.
import { key } from './fig.mjs';

const hex2 = (x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
const rgb = (c) => '#' + hex2(c.r) + hex2(c.g) + hex2(c.b);
const num = (v) => +(+v).toFixed(2);

export function createRenderer(fig, opts = {}) {
  const { nodes, blobs } = fig;
  const prefix = opts.idPrefix || 'f';
  const currentColor = !!opts.currentColor; // icons: solid fills become currentColor
  const decorate = opts.decorate || ((n, body) => body);
  const include = opts.include || (() => true); // filter for the root's direct children
  const defs = [];
  const pathCache = new Map();
  let uid = 0;
  const nid = (p) => `${prefix}-${p}${++uid}`;

  function blobPath(idx) {
    if (pathCache.has(idx)) return pathCache.get(idx);
    const b = blobs[idx];
    let i = 0, d = '';
    const f = () => { const v = b.readFloatLE(i); i += 4; return +v.toFixed(3); };
    while (i < b.length) {
      const c = b[i++];
      if (c === 0) { if (d && !d.endsWith('Z')) d += 'Z'; }
      else if (c === 1) d += `M${f()} ${f()}`;
      else if (c === 2) d += `L${f()} ${f()}`;
      else if (c === 3) d += `Q${f()} ${f()} ${f()} ${f()}`;
      else if (c === 4) d += `C${f()} ${f()} ${f()} ${f()} ${f()} ${f()}`;
      else throw new Error(`Unknown path command ${c} in blob ${idx}`);
    }
    pathCache.set(idx, d);
    return d;
  }

  function solidAttr(p) {
    const a = (p.color.a ?? 1) * (p.opacity ?? 1);
    const color = currentColor ? 'currentColor' : rgb(p.color);
    return `fill="${color}"` + (a < 1 && !currentColor ? ` fill-opacity="${num(a)}"` : '');
  }

  function paintPath(d, rule, paints) {
    let out = '';
    for (const p of paints || []) {
      if (p.visible === false || p.type !== 'SOLID') continue;
      out += `<path d="${d}" ${solidAttr(p)}${rule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`;
    }
    return out;
  }

  const drawGeometry = (geoms, paints) =>
    (geoms || []).map((g) => paintPath(blobPath(g.commandsBlob), g.windingRule === 'ODD' ? 'evenodd' : 'nonzero', paints)).join('');

  function rectPath(n, w, h) {
    if (n.rectangleCornerRadiiIndependent) {
      const tl = n.rectangleTopLeftCornerRadius || 0, tr = n.rectangleTopRightCornerRadius || 0;
      const br = n.rectangleBottomRightCornerRadius || 0, bl = n.rectangleBottomLeftCornerRadius || 0;
      return `M${tl} 0H${w - tr}A${tr} ${tr} 0 0 1 ${w} ${tr}V${h - br}A${br} ${br} 0 0 1 ${w - br} ${h}H${bl}A${bl} ${bl} 0 0 1 0 ${h - bl}V${tl}A${tl} ${tl} 0 0 1 ${tl} 0Z`;
    }
    const r = Math.min(n.cornerRadius || 0, w / 2, h / 2);
    if (!r) return `M0 0H${num(w)}V${num(h)}H0Z`;
    return `M${r} 0H${num(w - r)}A${r} ${r} 0 0 1 ${num(w)} ${r}V${num(h - r)}A${r} ${r} 0 0 1 ${num(w - r)} ${num(h)}H${r}A${r} ${r} 0 0 1 0 ${num(h - r)}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  }

  function effectsFilter(n) {
    const fx = (n.effects || []).filter((e) => e.visible !== false && e.type === 'DROP_SHADOW');
    if (!fx.length || opts.noEffects) return '';
    const W = n.size?.x || 0, H = n.size?.y || 0;
    const id = nid('fx');
    let prims = '';
    const merge = [];
    fx.forEach((e, k) => {
      prims += `<feGaussianBlur in="SourceAlpha" stdDeviation="${num((e.radius || 0) / 2)}"/>` +
        `<feOffset dx="${num(e.offset?.x || 0)}" dy="${num(e.offset?.y || 0)}" result="o${k}"/>` +
        `<feFlood flood-color="${rgb(e.color)}" flood-opacity="${num(e.color.a ?? 1)}"/>` +
        `<feComposite in2="o${k}" operator="in" result="s${k}"/>`;
      merge.push(`s${k}`);
    });
    prims += `<feMerge>${merge.map((r) => `<feMergeNode in="${r}"/>`).join('')}<feMergeNode in="SourceGraphic"/></feMerge>`;
    defs.push(`<filter id="${id}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="${num(W + 400)}" height="${num(H + 400)}" color-interpolation-filters="sRGB">${prims}</filter>`);
    return id;
  }

  function drawText(n) {
    const dtd = n.derivedTextData;
    if (!dtd || !dtd.glyphs) return '';
    const styleIDs = n.textData?.characterStyleIDs || [];
    const table = new Map((n.textData?.styleOverrideTable || []).map((s) => [s.styleID, s]));
    let out = '';
    for (const g of dtd.glyphs) {
      if (g.commandsBlob == null) continue;
      const d = blobPath(g.commandsBlob);
      if (!d) continue;
      const style = table.get(styleIDs[g.firstCharacter]);
      const paints = style?.fillPaints || n.fillPaints || [];
      const p = paints.find((q) => q.type === 'SOLID' && q.visible !== false);
      if (!p) continue;
      out += `<path transform="matrix(${num(g.fontSize)} 0 0 ${num(-g.fontSize)} ${num(g.position.x)} ${num(g.position.y)})" d="${d}" ${solidAttr(p)}/>`;
    }
    return out;
  }

  // ctx = { ov: Map(overridePath -> props), prefix: string[], inInst: bool, props: Map }
  function renderNode(n, ctx, isRoot, depth) {
    const nk = n.overrideKey ? key(n.overrideKey) : n._id;
    const ov = ctx.ov.get([...ctx.prefix, nk].join('/')) || ctx.ov.get([...ctx.prefix, n._id].join('/'));
    const P = ov ? Object.assign(Object.create(n), ov) : n;
    if (P.visible === false && !isRoot) return '';
    if (P.componentPropRefs && ctx.props) {
      for (const ref of P.componentPropRefs) {
        const v = ctx.props.get(key(ref.defID));
        if (ref.componentPropNodeField === 'VISIBLE' && v && v.boolValue === false) return '';
      }
    }
    const w = P.size?.x || 0, h = P.size?.y || 0;
    let body = '';

    if (P.type === 'TEXT') {
      body = drawText(P);
    } else if (['FRAME', 'SYMBOL', 'INSTANCE'].includes(P.type)) {
      if (!(isRoot && opts.transparentRoot)) {
        if (P.fillGeometry?.length) body += drawGeometry(P.fillGeometry, P.fillPaints);
        else if (P.fillPaints?.some((p) => p.visible !== false)) body += paintPath(rectPath(P, w, h), 'nonzero', P.fillPaints);
      }
      let kids = '';
      if (P.type === 'INSTANCE') {
        const sid = (P.overriddenSymbolID && key(P.overriddenSymbolID)) || (P.symbolData?.symbolID && key(P.symbolData.symbolID));
        const sym = nodes.get(sid);
        if (sym) {
          const myPrefix = isRoot || !ctx.inInst ? [] : [...ctx.prefix, nk];
          const own = new Map();
          const add = (arr) => {
            for (const o of arr || []) {
              const k = [...myPrefix, ...o.guidPath.guids.map(key)].join('/');
              own.set(k, Object.assign({}, own.get(k) || {}, o, { guidPath: undefined }));
            }
          };
          add(P.symbolData?.symbolOverrides);
          add(P.derivedSymbolData);
          const ov2 = new Map(ctx.ov);
          for (const [k, o] of own) ov2.set(k, Object.assign({}, o, ctx.ov.get(k) || {})); // outer overrides win
          const props = new Map(ctx.props || []);
          for (const a of P.componentPropAssignments || []) props.set(key(a.defID), a.varValue?.value || a.value);
          const sub = { ov: ov2, prefix: myPrefix, props, inInst: true };
          for (const k of sym._kids) kids += renderNode(k, sub, false, depth + 1);
        }
      } else {
        for (const k of P._kids || []) {
          if (isRoot && !include(k)) continue;
          kids += renderNode(k, ctx, false, depth + 1);
        }
      }
      const clips = !P.resizeToFit && !P.frameMaskDisabled;
      if (clips && (w < 0.01 || h < 0.01)) kids = '';
      if (clips && kids && !isRoot) {
        const cid = nid('c');
        defs.push(`<clipPath id="${cid}"><path d="${rectPath(P, w, h)}"/></clipPath>`);
        kids = `<g clip-path="url(#${cid})">${kids}</g>`;
      }
      body += kids;
      body += drawGeometry(P.strokeGeometry, P.strokePaints);
    } else {
      if (P.fillGeometry?.length) body += drawGeometry(P.fillGeometry, P.fillPaints);
      else if (P.type === 'ROUNDED_RECTANGLE') body += paintPath(rectPath(P, w, h), 'nonzero', P.fillPaints);
      body += drawGeometry(P.strokeGeometry, P.strokePaints);
    }
    if (!body) return '';
    const fid = effectsFilter(P);
    if (fid) body = `<g filter="url(#${fid})">${body}</g>`;
    body = decorate(P, body, { depth, isRoot });
    if (isRoot) return body;

    const t = P.transform;
    let attrs = '';
    if (t) {
      const identityLinear = Math.abs(t.m00 - 1) < 1e-5 && Math.abs(t.m11 - 1) < 1e-5 && Math.abs(t.m01) < 1e-5 && Math.abs(t.m10) < 1e-5;
      attrs += identityLinear
        ? (num(t.m02) || num(t.m12) ? ` transform="translate(${num(t.m02)} ${num(t.m12)})"` : '')
        : ` transform="matrix(${+t.m00.toFixed(4)} ${+t.m10.toFixed(4)} ${+t.m01.toFixed(4)} ${+t.m11.toFixed(4)} ${num(t.m02)} ${num(t.m12)})"`;
    }
    if (P.opacity != null && P.opacity < 1) attrs += ` opacity="${num(P.opacity)}"`;
    return attrs ? `<g${attrs}>${body}</g>` : body;
  }

  return {
    /** Render a node to an SVG document string. */
    render(id, { viewBox, attrs = '', style = '' } = {}) {
      const n = nodes.get(id);
      if (!n) throw new Error(`Node ${id} not found`);
      const w = num(n.size.x), h = num(n.size.y);
      const body = renderNode(n, { ov: new Map(), prefix: [], inInst: false }, true, 0);
      const vb = viewBox || `0 0 ${w} ${h}`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${attrs}>` +
        (style ? `<style>${style}</style>` : '') +
        (defs.length ? `<defs>${defs.join('')}</defs>` : '') + body + '</svg>';
    },
  };
}
