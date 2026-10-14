import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './ui.jsx';

/** Focus-trapping dialog: Escape or the backdrop closes it, focus returns to where it was. */
export default function Modal({ title, description, onClose, children, footer, wide = false }) {
  const body = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    body.current?.querySelector('.modal__card textarea, .modal__card input, .modal__card button, .modal__footer button')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key !== 'Tab' || !body.current) return;
      const items = [...body.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div ref={body} className={`modal__body${wide ? ' modal__body--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__head">
          <div>
            <h2 className="modal__title">{title}</h2>
            {description && <p className="modal__desc">{description}</p>}
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="modal__card">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Right-hand slide-over panel. */
export function Drawer({ title, icon, onClose, children, footer, modal = true, className = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <>
      {modal && <div className="drawer-scrim" onMouseDown={onClose} />}
      <aside className={`drawer ${className}`} role="dialog" aria-modal={modal} aria-label={typeof title === 'string' ? title : undefined}>
        <header className="drawer__head">
          {icon}
          <h2 className="drawer__title">{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__foot">{footer}</footer>}
      </aside>
    </>,
    document.body,
  );
}
