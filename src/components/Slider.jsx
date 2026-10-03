import { useRef } from 'react';

/**
 * Material 3 "Standard slider" (XSmall) as overridden in the design:
 * ink active track, sand inactive track, 4px ink handle with a gap either side.
 */
export default function Slider({ value, onChange, label, valueText, min = 0, max = 100, step = 5, ends }) {
  const track = useRef(null);
  const pct = ((value - min) / (max - min)) * 100;

  function setFromPointer(e) {
    const r = track.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = Math.round((min + ratio * (max - min)) / step) * step;
    if (v !== value) onChange(v);
  }

  function onKeyDown(e) {
    const big = (max - min) / 10;
    const next = { ArrowRight: value + step, ArrowUp: value + step, ArrowLeft: value - step, ArrowDown: value - step, PageUp: value + big, PageDown: value - big, Home: min, End: max }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onChange(Math.min(max, Math.max(min, next)));
  }

  return (
    <div
      ref={track}
      className="slider"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText?.(value)}
      style={{ '--pct': `${pct}%` }}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromPointer(e);
      }}
      onPointerMove={(e) => e.buttons === 1 && setFromPointer(e)}
    >
      <span className="slider__active" />
      <span className="slider__inactive" />
      <span className="slider__stop" />
      <span className="slider__handle" />
      {ends && (
        <span className="slider__ends" aria-hidden="true">
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </span>
      )}
    </div>
  );
}
