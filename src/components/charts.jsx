import { useEffect, useRef, useState } from 'react';
import '../styles/charts.css';

/** Width of an element, kept up to date (charts draw in real pixels so text never stretches). */
export function useWidth(fallback = 600) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Tiny trend line for KPI tiles (no axes; the tile's number is the label). */
export function Spark({ values, width = 96, height = 36, color = 'var(--chart-1-deep)', area = true }) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return null;
  const min = Math.min(...v), max = Math.max(...v);
  const span = max - min || 1;
  const x = (i) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = (val) => height - 4 - ((val - min) / span) * (height - 10);
  const pts = values.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`);
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {area && <polygon points={`${x(0)},${height} ${pts.join(' ')} ${x(values.length - 1)},${height}`} style={{ fill: color }} className="spark__area" />}
      <polyline points={pts.join(' ')} style={{ stroke: color }} className="spark__line" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r="3" style={{ fill: color }} className="spark__dot" />
    </svg>
  );
}

/**
 * Line over seasons with a crosshair and tooltip. One series (`values`) plus an optional
 * min–max band. `selected` highlights a season; `onSelect(i)` makes the seasons clickable.
 */
export function LineChart({ labels, values, band, height = 220, min: minIn, max: maxIn, unit = '', selected, onSelect, seriesLabel = 'Farm average', bandLabel = 'Range across paddocks', baseline, baselineLabel }) {
  // fit the axis to the data (rounded to tens) unless a range is given
  const all = [...values, ...(band ? band.flat() : []), ...(baseline != null ? [baseline] : [])];
  const min = minIn ?? Math.max(0, Math.floor((Math.min(...all) - 5) / 10) * 10);
  const max = maxIn ?? Math.min(100, Math.ceil((Math.max(...all) + 5) / 10) * 10);
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 34, r: 14, t: 14, b: 26 };
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const n = labels.length;
  const x = (i) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const ticks = [min, min + (max - min) / 2, max];
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const bandPts = band && [...band.map((b, i) => `${x(i)},${y(b[1])}`), ...band.map((b, i) => `${x(i)},${y(b[0])}`).reverse()].join(' ');
  const focus = hover ?? selected;

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1)))));
  }

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${seriesLabel}: ${values.map((v, i) => `${labels[i]} ${v}${unit}`).join(', ')}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onClick={() => onSelect && hover != null && onSelect(hover)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="chart__axis">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l} x={x(i)} y={height - 6} textAnchor="middle" className={`chart__axis${i === focus ? ' is-focus' : ''}`}>
            {l}
          </text>
        ))}
        {baseline != null && (
          <g>
            <line x1={pad.l} x2={width - pad.r} y1={y(baseline)} y2={y(baseline)} className="chart__baseline" />
            <text x={pad.l + 6} y={y(baseline) + (baseline - min > (max - min) / 2 ? 14 : -6)} className="chart__axis">
              {baselineLabel}
            </text>
          </g>
        )}
        {bandPts && <polygon points={bandPts} className="chart__band" />}
        <polyline points={line} className="chart__line" />
        {focus != null && <line x1={x(focus)} x2={x(focus)} y1={pad.t} y2={pad.t + ih} className="chart__cross" />}
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === focus ? 5 : 3} className={`chart__dot${i === focus ? ' is-focus' : ''}`} />
        ))}
      </svg>
      {hover != null && (
        <div className="chart__tip" style={{ left: Math.min(width - 150, Math.max(0, x(hover) - 70)), top: Math.max(0, y(values[hover]) - 70) }}>
          <strong>{labels[hover]}</strong>
          <span>
            <i className="chart__key chart__key--line" /> {seriesLabel} <b className="num">{values[hover]}{unit}</b>
          </span>
          {band && (
            <span>
              <i className="chart__key chart__key--band" /> {bandLabel} <b className="num">{band[hover][0]}–{band[hover][1]}{unit}</b>
            </span>
          )}
        </div>
      )}
      {band && (
        <div className="chart__legend">
          <span>
            <i className="chart__key chart__key--line" /> {seriesLabel}
          </span>
          <span>
            <i className="chart__key chart__key--band" /> {bandLabel}
          </span>
        </div>
      )}
    </div>
  );
}

/** Ring of shares with the total in the middle. items: [{ id, label, value, color }] */
export function Donut({ items, size = 168, thickness = 22, total, totalLabel, format = (v) => v, active, onActive }) {
  const [hover, setHover] = useState(null);
  const sum = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = size / 2 - thickness / 2 - 2;
  const c = 2 * Math.PI * r;
  const gap = items.length > 1 ? 2 : 0; // 2px surface gap between segments
  const focus = hover ?? active;
  let acc = 0;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={items.map((i) => `${i.label} ${format(i.value)}`).join(', ')}>
        <circle cx={size / 2} cy={size / 2} r={r} className="donut__track" style={{ strokeWidth: thickness }} />
        {items.map((it) => {
          const len = (it.value / sum) * c;
          const seg = (
            <circle
              key={it.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              className={`donut__seg${focus && focus !== it.id ? ' is-dim' : ''}`}
              style={{ stroke: it.color, strokeWidth: focus === it.id ? thickness + 4 : thickness, strokeDasharray: `${Math.max(0, len - gap)} ${c}`, strokeDashoffset: -acc }}
              onPointerEnter={() => (setHover(it.id), onActive?.(it.id))}
              onPointerLeave={() => (setHover(null), onActive?.(null))}
            />
          );
          acc += len;
          return seg;
        })}
      </svg>
      <div className="donut__center">
        {focus ? (
          <>
            <strong className="num">{format(items.find((i) => i.id === focus)?.value ?? 0)}</strong>
            <span>{items.find((i) => i.id === focus)?.label}</span>
          </>
        ) : (
          <>
            <strong className="num">{total}</strong>
            <span>{totalLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Vertical bars with a value on hover and the value printed above the focused bar. */
export function BarChart({ items, height = 200, unit = '', color = 'var(--chart-1)', format = (v) => v, reference, referenceLabel }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { l: 36, r: 10, t: 22, b: 26 };
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const vals = items.map((i) => i.value ?? 0);
  const max = Math.max(...vals, reference ?? 0, 1) * 1.1;
  const slot = iw / Math.max(1, items.length);
  const bw = Math.min(42, slot * 0.6);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max].map((t) => Math.round(t / 10) * 10);
  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={items.map((i) => `${i.label}: ${i.value == null ? 'no data' : format(i.value) + unit}`).join(', ')}>
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="chart__axis">
              {t}
            </text>
          </g>
        ))}
        {reference != null && (
          <g>
            <line x1={pad.l} x2={width - pad.r} y1={y(reference)} y2={y(reference)} className="chart__baseline" />
            <text x={width - pad.r} y={y(reference) - 5} textAnchor="end" className="chart__axis">
              {referenceLabel}
            </text>
          </g>
        )}
        {items.map((it, i) => {
          const cx = pad.l + slot * i + slot / 2;
          const v = it.value;
          const h = v == null ? 0 : Math.max(2, ih - (y(v) - pad.t));
          return (
            <g key={it.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={cx - slot / 2} y={pad.t} width={slot} height={ih} fill="transparent" />
              {v != null && <path d={roundedTop(cx - bw / 2, pad.t + ih - h, bw, h, 4)} style={{ fill: it.color || color }} className={`chart__bar${hover != null && hover !== i ? ' is-dim' : ''}`} />}
              {v == null && (
                <text x={cx} y={pad.t + ih - 6} textAnchor="middle" className="chart__axis">
                  –
                </text>
              )}
              {hover === i && v != null && (
                <text x={cx} y={pad.t + ih - h - 6} textAnchor="middle" className="chart__value">
                  {format(v)}
                  {unit}
                </text>
              )}
              <text x={cx} y={height - 6} textAnchor="middle" className={`chart__axis${hover === i ? ' is-focus' : ''}`}>
                {it.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** A bar whose top corners are rounded and whose base sits flat on the axis. */
function roundedTop(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/** Horizontal meter with the value at the end (soil health in tables and lists). */
export function Meter({ value, max = 100, delta, tone }) {
  const v = Math.max(0, Math.min(max, value ?? 0));
  const t = tone || (v >= 65 ? 'ok' : v >= 45 ? 'mid' : 'low');
  return (
    <span className="meter">
      <span className={`meter__track meter--${t}`}>
        <span style={{ width: `${(v / max) * 100}%` }} />
      </span>
      <span className="meter__value num">{Math.round(v)}</span>
      {delta != null && <span className={`meter__delta num ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>{delta > 0 ? `+${delta}` : delta}</span>}
    </span>
  );
}
