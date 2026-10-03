import Icon from './Icon.jsx';
import { Card } from './ui.jsx';
import { CROPS } from '../data/crops.js';

/** "Crops grown in the <Last Season>" card: one dropdown per crop, + adds another. */
export default function CropSeasonCard({ label, value, onChange }) {
  const crops = value?.length ? value : [''];
  const set = (i, id) => onChange(crops.map((c, j) => (j === i ? id : c)));
  const remove = (i) => onChange(crops.filter((_, j) => j !== i));

  return (
    <Card className="crop-card">
      <h2 className="card__title">
        Crops grown in the <span className="accent">{label}</span>
      </h2>
      <div className="crop-rows">
        {crops.map((id, i) => {
          const last = i === crops.length - 1;
          return (
            <div className="crop-row" key={i}>
              <label className="select">
                <span className="visually-hidden">
                  Crop {i + 1} in the {label}
                </span>
                <select className={`field__input select__input ${id ? '' : 'is-empty'}`} value={id} onChange={(e) => set(i, e.target.value)}>
                  <option value="">Crop Name</option>
                  {CROPS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <Icon name="arrow-drop-down" size={28} className="select__icon" />
              </label>
              {last ? (
                <button type="button" className="add-btn" aria-label={`Add another crop for the ${label}`} onClick={() => onChange([...crops, ''])} disabled={!id}>
                  <Icon name="add" size={24} />
                </button>
              ) : (
                <button type="button" className="add-btn" aria-label={`Remove crop ${i + 1}`} onClick={() => remove(i)}>
                  <Icon name="close" size={22} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
