import { useEffect, useRef, useState } from 'react';

/**
 * Decides when to show a loading screen for `busy`: only after `delay` ms (so quick
 * waits don't flash it), and once shown, for at least `minVisible` ms (so it doesn't blink).
 */
export function useLoadingGate(busy, { delay = 300, minVisible = 900 } = {}) {
  const [show, setShow] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (busy) {
      if (show) return;
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setShow(true);
      }, delay);
      return () => clearTimeout(t);
    }
    if (!show) return;
    const left = Math.max(0, minVisible - (Date.now() - shownAt.current));
    const t = setTimeout(() => setShow(false), left);
    return () => clearTimeout(t);
  }, [busy, show, delay, minVisible]);

  return show;
}
