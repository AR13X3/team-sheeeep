import { useId } from 'react';
import Icon from './Icon.jsx';
import SheepRunner from './SheepRunner.jsx';
import '../styles/components.css';

/**
 * "Action Button" component set: tone = primary | secondary | danger,
 * plus the login card's "Button" (login) and "Group 15" (outline) sets.
 * size = large (366x82) | compact (110x82) | small (207x56)
 */
export function Button({ tone = 'primary', size = 'large', icon, iconEnd, className = '', type = 'button', children, ...props }) {
  return (
    <button type={type} className={`btn btn--${tone} btn--${size} ${className}`} {...props}>
      {icon && <Icon name={icon} size={22} className="btn__icon" />}
      <span className="btn__label">{children}</span>
      {iconEnd && <Icon name={iconEnd} size={22} className="btn__icon btn__icon--end" />}
    </button>
  );
}

/** "Back Button" component set: 70px cream circle. */
export function RoundButton({ icon, label, className = '', ...props }) {
  return (
    <button type="button" className={`round-btn ${className}`} aria-label={label} title={label} {...props}>
      <Icon name={icon} size={35} />
    </button>
  );
}

/** The tab hanging from the top edge with the screen title. */
export function TitleTab({ children, steps }) {
  return (
    <header className={`title-tab ${steps ? 'title-tab--steps' : ''}`}>
      <h1>{children}</h1>
      {steps}
    </header>
  );
}

export function Card({ as: Tag = 'section', title, className = '', children, ...props }) {
  return (
    <Tag className={`card ${className}`} {...props}>
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </Tag>
  );
}

export function TextField({ label, className = '', ...props }) {
  return (
    <label className={`field ${className}`}>
      <span className="visually-hidden">{label}</span>
      <input className="field__input" placeholder={label} {...props} />
    </label>
  );
}

export function TextArea({ label, className = '', placeholder = 'Type Here...', ...props }) {
  return (
    <label className={`field field--area ${className}`}>
      <span className="visually-hidden">{label}</span>
      <textarea className="field__input" placeholder={placeholder} {...props} />
    </label>
  );
}

/** Material 3 checkbox, recoloured in the design (ink box, cream tick). */
export function Checkbox({ label, checked, onChange }) {
  const id = useId();
  return (
    <div className="check">
      <input id={id} type="checkbox" className="check__input" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="check__box" aria-hidden="true">
        <Icon name="check" size={24} />
      </span>
      <label htmlFor={id} className="check__label">
        {label}
      </label>
    </div>
  );
}

/** Small status line used inside auto-filled cards (a tiny sheep runs while loading). */
export function Status({ state, children }) {
  if (state === 'loading')
    return (
      <div className="status status--loading" role="status">
        <SheepRunner count={1} size={34} speed={1.8} className="runner-lane--mini" />
        <span>{children || 'Fetching data…'}</span>
      </div>
    );
  if (state === 'error') return <p className="status status--error">{children || 'Could not load this data right now.'}</p>;
  return null;
}
