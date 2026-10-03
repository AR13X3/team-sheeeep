import Art from './Art.jsx';
import '../styles/loading.css';

const FLOCK = [3, 6, 4, 2, 5, 1];

/**
 * A lane of sheep hopping across, legs kicking and ears flapping, with dust puffs behind.
 * `size` is each sheep's width in px; the lane fills its container's width.
 */
export default function SheepRunner({ count = 3, size = 90, speed = 3.4, className = '' }) {
  return (
    <div className={`runner-lane ${className}`} style={{ '--size': `${size}px`, '--count': count, '--run': `${speed}s` }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="runner" style={{ '--n': i }}>
          {[0, 1, 2].map((p) => (
            <span key={p} className="runner__puff" style={{ '--p': p }} />
          ))}
          <div className="runner__hop">
            <Art name={`sheep-${FLOCK[i % FLOCK.length]}`} className="runner__art" />
          </div>
        </div>
      ))}
    </div>
  );
}
