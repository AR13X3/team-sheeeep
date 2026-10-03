import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Olive frosted overlay + card, as in the "Why?" dialog. */
export default function Modal({ title, onClose, children, footer, wide = false }) {
  const card = useRef(null);

  useEffect(() => {
    const prev = document.activeElement;
    card.current?.querySelector('textarea, input, button')?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal__body${wide ? ' modal__body--wide' : ''}`}>
        <div ref={card} className="card modal__card" role="dialog" aria-modal="true" aria-label={title}>
          <h2 className="card__title modal__title">{title}</h2>
          {children}
        </div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
