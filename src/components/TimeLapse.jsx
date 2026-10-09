import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { fmtDate } from '../logic/seasons.js';

/**
 * Real satellite true-colour images of the farm across seasons, with one paddock outlined.
 * Sentinel passes are shown at 10 m (original Sentinel-2), Landsat passes at 30 m (NASA HLS).
 * Frames come from services/space.js (one near each season's peak, plus canola flowering).
 */
export default function TimeLapse({ frames = [], bbox, grid, coords }) {
  const [i, setI] = useState(frames.length - 1);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState({});

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((k) => (k + 1) % frames.length), 1400);
    return () => clearInterval(t);
  }, [playing, frames.length]);

  // preload the frames so playback is smooth
  useEffect(() => {
    frames.forEach((f) => {
      const img = new Image();
      img.onload = () => setLoaded((l) => ({ ...l, [f.url]: true }));
      img.src = f.url;
    });
  }, [frames]);

  if (!frames.length) return null;
  const frame = frames[Math.max(0, Math.min(i, frames.length - 1))];
  const [w, s, e, n] = bbox;
  const pts = coords.map(([lat, lng]) => `${(((lng - w) / (e - w)) * grid[0]).toFixed(1)},${(((n - lat) / (n - s)) * grid[1]).toFixed(1)}`).join(' ');

  return (
    <figure className="timelapse">
      <div className="timelapse__view" style={{ aspectRatio: `${grid[0]} / ${grid[1]}` }}>
        {frames.map((f) => (
          <img key={f.url} src={f.url} alt="" className={f === frame ? 'is-current' : ''} />
        ))}
        {!loaded[frame.url] && <span className="timelapse__wait">Loading image…</span>}
        <svg viewBox={`0 0 ${grid[0]} ${grid[1]}`} preserveAspectRatio="none" aria-hidden="true">
          <polygon points={pts} className="timelapse__outline-halo" />
          <polygon points={pts} className="timelapse__outline" />
        </svg>
        <span className={`timelapse__tag ${frame.kind === 'flowering' ? 'is-flowering' : ''}`}>
          {fmtDate(frame.date)} · {frame.kind === 'flowering' ? 'canola flowering' : 'mid-season'}
          {frame.sensor && <span className="timelapse__sensor"> · {frame.sensor} {frame.metres} m</span>}
        </span>
      </div>
      <figcaption className="timelapse__controls">
        <button type="button" className="timelapse__play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause time-lapse' : 'Play time-lapse'}>
          <Icon name={playing ? 'pause' : 'play'} size={15} />
        </button>
        <div className="timelapse__dots" role="tablist" aria-label="Satellite images">
          {frames.map((f, k) => (
            <button
              key={f.url}
              type="button"
              role="tab"
              aria-selected={k === i}
              className={`${k === i ? 'is-current' : ''}${f.kind === 'flowering' ? ' is-flowering' : ''}`}
              onClick={() => (setI(k), setPlaying(false))}
              title={`${fmtDate(f.date)}${f.kind === 'flowering' ? ' · canola flowering' : ''}`}
            >
              {f.kind === 'flowering' ? `Flowering ’${String(new Date(f.date).getFullYear()).slice(2)}` : new Date(f.date).getFullYear()}
            </button>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
