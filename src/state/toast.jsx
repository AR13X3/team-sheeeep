import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, IconButton } from '../components/ui.jsx';

const ToastContext = createContext(() => {});
const ICON = { ok: 'circle-check', warn: 'alert', bad: 'circle-x', info: 'info', satellite: 'satellite' };

/**
 * toast({ title, description, tone: 'ok'|'warn'|'bad'|'info', icon, action: { label, onClick }, duration })
 * Toasts stack bottom-right, pause on hover and close themselves.
 */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 200);
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (t) => {
      const id = Math.random().toString(36).slice(2);
      const duration = t.duration ?? (t.action ? 7000 : 4500);
      setItems((list) => [...list.slice(-3), { id, tone: 'ok', ...t, duration }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  // hovering a toast pauses its countdown
  const pause = (id) => clearTimeout(timers.current.get(id));
  const resume = (t) => timers.current.set(t.id, setTimeout(() => dismiss(t.id), 2500));

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}${t.leaving ? ' is-leaving' : ''}`} role="status" onMouseEnter={() => pause(t.id)} onMouseLeave={() => resume(t)}>
            <span className="toast__icon">
              <Icon name={t.icon || ICON[t.tone] || 'info'} size={15} />
            </span>
            <div>
              <p className="toast__title">{t.title}</p>
              {t.description && <p className="toast__desc">{t.description}</p>}
            </div>
            <div className="toast__actions">
              {t.action && (
                <Button
                  tone="plain"
                  size="sm"
                  onClick={() => {
                    t.action.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </Button>
              )}
              <IconButton icon="close" label="Dismiss" size="sm" onClick={() => dismiss(t.id)} />
            </div>
            <span className="toast__timer" style={{ animationDuration: `${t.duration}ms` }} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

