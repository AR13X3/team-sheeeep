/** Tiny greenness (NDVI) curve for one season. */
export default function Sparkline({ series = [], start, end, width = 132, height = 34, color = '#66702f', label }) {
  if (!series.length) return <span className="sparkline sparkline--empty" style={{ width, height }} aria-hidden="true" />;
  const t0 = Date.parse(start), t1 = Date.parse(end);
  const x = (d) => 2 + ((Date.parse(d) - t0) / (t1 - t0)) * (width - 4);
  const y = (v) => height - 3 - Math.max(0, Math.min(1, v)) * (height - 6);
  const pts = series.map(([d, v]) => `${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const peak = series.reduce((m, p) => (p[1] > m[1] ? p : m), series[0]);
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label || `Greenness peaked at ${peak[1]}`}>
      <line x1="0" x2={width} y1={y(0.5)} y2={y(0.5)} className="sparkline__ref" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {series.map(([d, v]) => (
        <circle key={d} cx={x(d)} cy={y(v)} r="1.6" fill={color} />
      ))}
      <circle cx={x(peak[0])} cy={y(peak[1])} r="3.2" fill="#ece4d4" stroke={color} strokeWidth="2" />
    </svg>
  );
}
