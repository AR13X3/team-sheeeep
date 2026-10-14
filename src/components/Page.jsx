import { useNavigate } from 'react-router-dom';
import Art from './Art.jsx';
import Icon from './Icon.jsx';
import { Button, IconButton } from './ui.jsx';
import { useShell } from './shell/ShellContext.js';
import { MASCOT_NAME } from '../config.js';
import { SCREEN_TIPS } from '../logic/manami.js';
import { useStore } from '../state/store.jsx';
import { SETUP_STEPS, setupProgress } from '../state/useFarm.js';

/** Onboarding progress across the top of setup pages; finished steps are links. */
export function SetupStepper({ step }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const { done } = setupProgress(state);
  const current = SETUP_STEPS.findIndex((s) => s.key === step);
  return (
    <nav className="stepper" aria-label={`Getting started: step ${current + 1} of ${SETUP_STEPS.length}`}>
      <ol>
        {SETUP_STEPS.map((s, i) => {
          const isDone = done[s.key] && i !== current;
          const reachable = isDone || i <= current;
          return (
            <li key={s.key} className={`${i === current ? 'is-current' : ''}${isDone ? ' is-done' : ''}`} aria-current={i === current ? 'step' : undefined}>
              <button type="button" disabled={!reachable || i === current} onClick={() => navigate(s.to(state))}>
                <span className="stepper__dot">{isDone ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}</span>
                <span className="stepper__label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** New farmers see one short tip per page from Manami, inline (it never covers the page). */
export function ManamiTip({ screen }) {
  const { state, dispatch } = useStore();
  const { openManami } = useShell();
  const tip = SCREEN_TIPS[screen];
  const id = `tip:${screen}`;
  if (!tip || state.experience !== 'new' || state.dismissedTips[id]) return null;
  return (
    <div className="tip" role="note">
      <span className="tip__face">
        <Art name="manami" />
      </span>
      <p className="tip__text">
        <strong>{MASCOT_NAME}’s tip · </strong>
        {tip}
      </p>
      <div className="tip__actions">
        <Button tone="plain" size="sm" icon="chat" onClick={() => openManami()}>
          Ask a question
        </Button>
        <IconButton icon="close" size="sm" label="Hide this tip" onClick={() => dispatch({ type: 'dismissTip', id })} />
      </div>
    </div>
  );
}

/**
 * Page frame: title, description and actions; optional onboarding stepper, Manami tip,
 * and a meta line (chips) under the title. `fill` lets the content take the full height.
 */
export default function Page({ title, description, actions, eyebrow, meta, step, tip, fill = false, wide = false, className = '', children }) {
  const { state } = useStore();
  const showStepper = step && !state.setupDone;
  return (
    <div className={`page${fill ? ' page--fill' : ''}${wide ? ' page--wide' : ''} ${className}`}>
      {showStepper && <SetupStepper step={step} />}
      {(title || actions) && (
        <header className="page__head">
          <div className="page__titles">
            {eyebrow && <div className="page__eyebrow">{eyebrow}</div>}
            {title && <h1 className="page__title">{title}</h1>}
            {description && <p className="page__desc">{description}</p>}
            {meta && <div className="page__meta">{meta}</div>}
          </div>
          {actions && <div className="page__actions">{actions}</div>}
        </header>
      )}
      {tip && <ManamiTip screen={tip} />}
      {children}
    </div>
  );
}
