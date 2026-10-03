// Icons exported from the Figma file…
import arrowBack from '../assets/icons/arrow-back.svg?raw';
import search from '../assets/icons/search.svg?raw';
import arrowDropDown from '../assets/icons/arrow-drop-down.svg?raw';
import add from '../assets/icons/add.svg?raw';
import check from '../assets/icons/check.svg?raw';
import close from '../assets/icons/close.svg?raw';
import menu from '../assets/icons/menu.svg?raw';
// …plus Material Icons for controls the design has no icon for (see material/README.txt).
import arrowForward from '../assets/icons/material/arrow-forward.svg?raw';
import myLocation from '../assets/icons/material/my-location.svg?raw';
import layers from '../assets/icons/material/layers.svg?raw';
import fit from '../assets/icons/material/fit.svg?raw';
import edit from '../assets/icons/material/edit.svg?raw';
import undo from '../assets/icons/material/undo.svg?raw';
import remove from '../assets/icons/material/remove.svg?raw';
import del from '../assets/icons/material/delete.svg?raw';
import plus from '../assets/icons/material/plus.svg?raw';
import done from '../assets/icons/material/done.svg?raw';

const ICONS = {
  'arrow-back': arrowBack,
  search,
  'arrow-drop-down': arrowDropDown,
  add,
  check,
  close,
  menu,
  'arrow-forward': arrowForward,
  'my-location': myLocation,
  layers,
  fit,
  edit,
  undo,
  remove,
  delete: del,
  plus,
  done,
};

/** Inline SVG icon; inherits `color`. */
export default function Icon({ name, size = 24, className = '', label }) {
  return (
    <span
      className={`svg-inline icon ${className}`}
      style={{ width: size, height: size, flex: 'none' }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
