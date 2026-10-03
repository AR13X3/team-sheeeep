/** The bar under the Planner map ("70%"): olive fill, value at its end, groove along the bottom. */
export default function ProgressBar({ value, label }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="progress card" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} title={label}>
      <span className="progress__fill" style={{ width: `${v}%` }} />
      <span className="progress__value" style={{ left: `max(64px, calc(${v}% - 19px))` }}>
        {v}%
      </span>
      <span className="progress__groove" />
    </div>
  );
}
