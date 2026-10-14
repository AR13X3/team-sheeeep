import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import SheepRunner from './SheepRunner.jsx';
import '../styles/ui.css';

const SIZE = { large: 'lg', compact: 'md', small: 'md' }; // sizes from the Figma build

/**
 * Buttons. Figma tones keep their exact fill and label colours: primary (olive), secondary
 * (gold), danger (rose), login and outline. Extra tones for dense tool UI: ghost, subtle.
 * size = sm | md | lg
 */
export function Button({ tone = 'primary', size = 'md', icon, iconEnd, loading = false, block = false, className = '', type = 'button', children, disabled, ...props }) {
  const sz = SIZE[size] || size;
  return (
    <button type={type} className={`btn btn--${tone} btn--${sz}${block ? ' btn--block' : ''}${loading ? ' is-loading' : ''} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <Icon name="spinner" size={sz === 'sm' ? 14 : 16} className="spin" /> : icon && <Icon name={icon} size={sz === 'sm' ? 14 : 16} className="btn__icon" />}
      {children != null && <span className="btn__label">{children}</span>}
      {iconEnd && <Icon name={iconEnd} size={sz === 'sm' ? 14 : 16} className="btn__icon btn__icon--end" />}
    </button>
  );
}

export function IconButton({ icon, label, tone = 'ghost', size = 'md', className = '', active, badge, ...props }) {
  return (
    <button type="button" className={`icon-btn icon-btn--${tone} icon-btn--${size}${active ? ' is-active' : ''} ${className}`} aria-label={label} data-tip={label} {...props}>
      <Icon name={icon} size={size === 'sm' ? 15 : 18} />
      {badge && <span className="icon-btn__badge" aria-hidden="true" />}
    </button>
  );
}

/** Panel with an optional header (icon, title, subtitle, actions on the right). */
export function Card({ as: Tag = 'section', title, subtitle, icon, actions, footer, className = '', flush = false, children, ...props }) {
  const head = title || actions;
  return (
    <Tag className={`card${flush ? ' card--flush' : ''} ${className}`} {...props}>
      {head && (
        <header className="card__head">
          <div className="card__heading">
            {icon && (
              <span className="card__icon">
                <Icon name={icon} size={16} />
              </span>
            )}
            <div>
              {title && <h2 className="card__title">{title}</h2>}
              {subtitle && <p className="card__subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      {children}
      {footer && <footer className="card__foot">{footer}</footer>}
    </Tag>
  );
}

export function Badge({ tone = 'neutral', icon, className = '', children, ...props }) {
  return (
    <span className={`badge badge--${tone} ${className}`} {...props}>
      {icon && <Icon name={icon} size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

/** Crop colour dot + name. */
export function CropChip({ crop, size = 'md', className = '', children }) {
  if (!crop) return <span className={`crop-chip crop-chip--${size} is-empty ${className}`}>{children || '—'}</span>;
  return (
    <span className={`crop-chip crop-chip--${size} ${className}`}>
      <span className="crop-dot" style={{ background: crop.color }} />
      {children || crop.name}
    </span>
  );
}

/** Button group with one choice (role=radiogroup). options: [{ value, label, icon }] */
export function Segmented({ options, value, onChange, label, size = 'md', className = '' }) {
  return (
    <div className={`segmented segmented--${size} ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)} title={o.title}>
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label && <span>{o.label}</span>}
        </button>
      ))}
    </div>
  );
}

export function TextField({ label, hint, icon, hideLabel = false, className = '', inputRef, end, ...props }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : 'field__label'}>
        {label}
      </label>
      <div className={`field__control${icon ? ' has-icon' : ''}${end ? ' has-end' : ''}`}>
        {icon && <Icon name={icon} size={16} className="field__icon" />}
        <input id={id} ref={inputRef} className="field__input" placeholder={hideLabel ? label : undefined} {...props} />
        {end && <span className="field__end">{end}</span>}
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, hint, hideLabel = false, className = '', placeholder = 'Type here…', ...props }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : 'field__label'}>
        {label}
      </label>
      <textarea id={id} className="field__input field__input--area" placeholder={placeholder} {...props} />
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

/** Checkbox with a visible label. */
export function Checkbox({ label, description, checked, onChange, className = '' }) {
  const id = useId();
  return (
    <div className={`check ${checked ? 'is-checked' : ''} ${className}`}>
      <input id={id} type="checkbox" className="check__input" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check__box" aria-hidden="true">
        <Icon name="check" size={13} strokeWidth={3} />
      </span>
      <label htmlFor={id} className="check__label">
        {label}
        {description && <span className="check__desc">{description}</span>}
      </label>
    </div>
  );
}

export function Switch({ checked, onChange, label, description, id: idProp }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <div className="switch-row">
      <div>
        <label htmlFor={id} className="switch-row__label">
          {label}
        </label>
        {description && <p className="switch-row__desc">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={!!checked} className={`switch ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

/** Animates a number towards `value` (eases over ~600 ms; instant with reduced motion). */
export function useCountUp(value, duration = 650) {
  const [shown, setShown] = useState(value ?? 0);
  const from = useRef(value ?? 0);
  useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  return shown;
}

export function AnimatedNumber({ value, decimals = 0, prefix = '', suffix = '' }) {
  const v = useCountUp(value);
  if (value == null) return <span className="num">–</span>;
  return (
    <span className="num">
      {prefix}
      {v.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/** KPI tile: label, big number, optional delta and a small chart on the right. */
export function Kpi({ label, icon, value, decimals = 0, suffix, unit, delta, deltaSuffix = '', deltaLabel, tone, chart, children, loading, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`kpi${tone ? ` kpi--${tone}` : ''}${onClick ? ' kpi--link' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="kpi__top">
        <span className="kpi__label">
          {icon && <Icon name={icon} size={15} />}
          {label}
        </span>
        {onClick && <Icon name="arrow-up-right" size={15} className="kpi__go" />}
      </div>
      <div className="kpi__main">
        <div>
          {loading ? (
            <Skeleton w={90} h={30} />
          ) : value === null ? null : (
            <p className="kpi__value">
              <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
              {unit && <span className="kpi__unit">{unit}</span>}
            </p>
          )}
          {delta != null && !loading && (
            <p className={`kpi__delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>
              <Icon name={delta > 0 ? 'trend-up' : delta < 0 ? 'trend-down' : 'remove'} size={14} />
              {delta > 0 ? '+' : ''}
              {delta}
              {deltaSuffix}
              {deltaLabel && <span> {deltaLabel}</span>}
            </p>
          )}
          {children}
        </div>
        {chart && <div className="kpi__chart">{chart}</div>}
      </div>
    </Tag>
  );
}

export function Progress({ value, tone = 'accent', label, size = 'md', className = '' }) {
  const v = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  return (
    <div className={`progress progress--${tone} progress--${size} ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function Skeleton({ w = '100%', h = 14, r, className = '' }) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}

export function EmptyState({ art, icon, title, children, action, className = '' }) {
  return (
    <div className={`empty ${className}`}>
      {art}
      {!art && icon && (
        <span className="empty__icon">
          <Icon name={icon} size={22} />
        </span>
      )}
      <h3 className="empty__title">{title}</h3>
      {children && <p className="empty__text">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export const Kbd = ({ children }) => <kbd className="kbd">{children}</kbd>;

/** Small status line used inside auto-filled cards (a tiny sheep runs while loading). */
export function Status({ state, children }) {
  if (state === 'loading')
    return (
      <div className="status status--loading" role="status">
        <SheepRunner count={1} size={30} speed={1.8} className="runner-lane--mini" />
        <span>{children || 'Fetching data…'}</span>
      </div>
    );
  if (state === 'error')
    return (
      <p className="status status--error">
        <Icon name="alert" size={14} />
        {children || 'Could not load this data right now.'}
      </p>
    );
  return null;
}

/** Labelled facts in a grid: items = [{ label, value, sub, icon }] */
export function Facts({ items, cols = 2 }) {
  return (
    <dl className="facts" style={{ '--cols': cols }}>
      {items.filter(Boolean).map((f) => (
        <div key={f.label} className="facts__item">
          <dt>
            {f.icon && <Icon name={f.icon} size={13} />}
            {f.label}
          </dt>
          <dd>
            {f.value}
            {f.sub && <span className="facts__sub">{f.sub}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const Source = ({ children }) => (
  <p className="source">
    <Icon name="database" size={12} />
    <span>{children}</span>
  </p>
);
