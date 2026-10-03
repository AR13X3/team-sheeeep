import manami from '../assets/art/manami.svg?raw';
import manamiLarge from '../assets/art/manami-large.svg?raw';
import sheep1 from '../assets/art/sheep-1.svg?raw';
import sheep2 from '../assets/art/sheep-2.svg?raw';
import sheep3 from '../assets/art/sheep-3.svg?raw';
import sheep4 from '../assets/art/sheep-4.svg?raw';
import sheep5 from '../assets/art/sheep-5.svg?raw';
import sheep6 from '../assets/art/sheep-6.svg?raw';

const ART = {
  manami,
  'manami-large': manamiLarge,
  'sheep-1': sheep1,
  'sheep-2': sheep2,
  'sheep-3': sheep3,
  'sheep-4': sheep4,
  'sheep-5': sheep5,
  'sheep-6': sheep6,
};

/** Wool colours of the six sheep, used to tint each paddock on the map. */
export const SHEEP_COLORS = { 1: '#372f2a', 2: '#847468', 3: '#a37758', 4: '#cdbfa1', 5: '#d1b8a6', 6: '#e595ac' };

/** Character illustrations exported from the Figma file (they bob and blink, see scene.css). */
export default function Art({ name, className = '', label, style }) {
  return (
    <span
      className={`svg-inline art ${className}`}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: ART[name] }}
    />
  );
}

export const SheepAvatar = ({ n, size = 40, className = '' }) => (
  <Art name={`sheep-${n}`} className={`sheep-avatar ${className}`} style={{ width: size, height: size * 0.86 }} />
);
