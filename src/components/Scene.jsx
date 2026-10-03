import { useEffect, useRef, useState } from 'react';
import '../styles/scene.css';

// `anchor` pins the 1280x832 artwork to the top or bottom of the viewport; `bg` fills
// whatever the artwork doesn't cover on tall screens. Artwork is loaded on demand.
const SCENES = {
  meadow: { load: () => import('../assets/scenes/meadow.svg?raw'), anchor: 'bottom', bg: 'var(--c-teal)' },
  field: { load: () => import('../assets/scenes/field.svg?raw'), anchor: 'top', bg: 'var(--c-soil)' },
  'field-paddock': { load: () => import('../assets/scenes/field-paddock.svg?raw'), anchor: 'top', bg: 'var(--c-soil)' },
  pond: { load: () => import('../assets/scenes/pond.svg?raw'), anchor: 'bottom', bg: 'var(--c-soil)' },
};
const loaded = new Map(); // name -> svg markup

function useSceneSvg(name) {
  const [svg, setSvg] = useState(() => loaded.get(name) || '');
  useEffect(() => {
    if (loaded.has(name)) {
      setSvg(loaded.get(name));
      return;
    }
    let alive = true;
    SCENES[name].load().then((m) => {
      loaded.set(name, m.default);
      if (alive) setSvg(m.default);
    });
    return () => {
      alive = false;
    };
  }, [name]);
  return svg;
}

const BAAS = ['Baa!', 'Baaa!', 'Meh-eh-eh!', 'Baa :3', 'Mbaa!'];

/** Full-bleed animated background. Click a sheep and it hops. */
export default function Scene({ name }) {
  const key = SCENES[name] ? name : 'field';
  const cfg = SCENES[key];
  const svg = useSceneSvg(key);
  const host = useRef(null);
  const [bubbles, setBubbles] = useState([]);

  // Gentle parallax: layers tagged fx-depth shift with the pointer (see scene.css).
  useEffect(() => {
    const el = host.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onMove = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  function onClick(e) {
    const sheep = e.target.closest?.('.fx-sheep');
    if (!sheep) return;
    sheep.classList.remove('is-hopping');
    void sheep.getBoundingClientRect(); // restart the animation
    sheep.classList.add('is-hopping');
    const r = sheep.getBoundingClientRect();
    const h = host.current.getBoundingClientRect();
    const id = Math.random();
    const text = BAAS[Math.floor(Math.random() * BAAS.length)];
    // measured in window pixels; the page is zoomed (see index.html), so convert back
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
    setBubbles((b) => [...b, { id, text, x: (r.left + r.width / 2 - h.left) / zoom, y: (r.top - h.top) / zoom }]);
    setTimeout(() => setBubbles((b) => b.filter((x) => x.id !== id)), 1500);
  }

  return (
    <div
      ref={host}
      className={`scene scene--${cfg.anchor}`}
      style={{ '--scene-bg': cfg.bg }}
      onClick={onClick}
      onAnimationEnd={(e) => e.target.classList?.remove('is-hopping')}
      aria-hidden="true"
    >
      <div className="scene__art svg-inline" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="scene__vignette" />
      {bubbles.map((b) => (
        <span key={b.id} className="scene__baa" style={{ left: b.x, top: b.y }}>
          {b.text}
        </span>
      ))}
    </div>
  );
}
