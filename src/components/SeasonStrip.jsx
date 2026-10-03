import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

/**
 * The Planner's season picker: one button per planned season, left to right.
 * Each shows the year and a dot per paddock in that season's crop colour, so the whole
 * rotation reads at a glance. Click a season, use the arrows, or ←/→ (Home/End) when focused.
 *
 * `crops[i]` = [{ paddock, name, color }] for season i. `nowIndex` = the coming season.
 */
export default function SeasonStrip({ labels, crops, selected, onChange, nowIndex = 0 }) {
  const list = useRef(null);
  const n = labels.length;
  const go = (i) => onChange(Math.max(0, Math.min(n - 1, i)));

  // keep the selected season in view when the strip scrolls (narrow screens)
  useEffect(() => {
    list.current?.children[selected]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selected]);

  function onKeyDown(e) {
    const next = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    go(next);
    list.current?.children[Math.max(0, Math.min(n - 1, next))]?.focus();
  }

  return (
    <nav className="season-strip card" aria-label="Seasons">
      <button type="button" className="season-strip__arrow" onClick={() => go(selected - 1)} disabled={selected === 0} aria-label="Previous season">
        <Icon name="arrow-back" size={22} />
      </button>
      <div ref={list} className="season-strip__list" role="tablist" aria-label="Season" onKeyDown={onKeyDown}>
        {labels.map((label, i) => {
          const year = 2000 + Number(label.slice(-2));
          const summary = crops[i].map((c) => `${c.paddock}: ${c.name}`).join(', ');
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={i === selected}
              tabIndex={i === selected ? 0 : -1}
              className={`season-strip__item${i === selected ? ' is-selected' : ''}${i === nowIndex ? ' is-now' : ''}`}
              onClick={() => go(i)}
              title={`Sown ${label} · ${summary}`}
              aria-label={`${year}, season ${i + 1}, sown ${label}. ${summary}`}
            >
              <span className="season-strip__year">{year}</span>
              <span className="season-strip__dots" aria-hidden="true">
                {crops[i].map((c) => (
                  <i key={c.paddock} style={{ background: c.color }} />
                ))}
              </span>
              <span className="season-strip__tag">{i === nowIndex ? 'Next' : `Season ${i + 1}`}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="season-strip__arrow season-strip__arrow--next" onClick={() => go(selected + 1)} disabled={selected === n - 1} aria-label="Next season">
        <Icon name="arrow-forward" size={22} />
      </button>
    </nav>
  );
}
