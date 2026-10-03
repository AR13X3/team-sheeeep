import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import SheepRunner from './SheepRunner.jsx';
import '../styles/loading.css';

/**
 * Full-screen loading state: a little meadow with the flock running across it.
 * `delay` (ms) avoids flashing it for waits that finish almost immediately.
 */
export default function LoadingScreen({ title = 'Herding the flock…', detail, progress, action, delay = 0 }) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (!delay) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!visible) return null;
  return createPortal(
    <div className="loading" role="status" aria-live="polite">
      <div className="loading__hill loading__hill--back" />
      <div className="loading__hill" />
      <div className="loading__panel">
        <p className="loading__title">{title}</p>
        {detail && <p className="loading__detail">{detail}</p>}
        {progress != null && (
          <div className="loading__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        )}
        {action && <div className="loading__action">{action}</div>}
      </div>
      <div className="loading__ground">
        <SheepRunner count={4} size={118} speed={4.2} className="loading__lane" />
      </div>
    </div>,
    document.body,
  );
}
