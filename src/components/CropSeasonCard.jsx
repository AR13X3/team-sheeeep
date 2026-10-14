import Icon from './Icon.jsx';
import { Badge, Card, CropChip, IconButton } from './ui.jsx';
import { CROPS, CROP_BY_ID } from '../data/crops.js';
import { firstPlannedSowing } from '../logic/seasons.js';

const ROWS = [
  { key: 'last', label: 'Last season', back: 1 },
  { key: 'prev', label: 'Two seasons ago', back: 2 },
  { key: 'prev2', label: 'Three seasons ago', back: 3 },
];
const CONF = { high: 'sure', medium: 'likely', low: 'best guess' };

/**
 * The paddock's last three seasons: one or more crops per season (double-cropping or a split
 * paddock). Empty seasons show what the satellites saw, which the planner uses unless it's a guess.
 */
export default function CropHistoryCard({ history, onChange, seen = {} }) {
  const first = firstPlannedSowing().getFullYear();
  return (
    <Card title="Crop history" subtitle="What grew here in the last three seasons. The plan follows on from it." icon="history">
      <div className="history-rows">
        {ROWS.map((row) => {
          const crops = history[row.key]?.length ? history[row.key] : [''];
          const typed = crops.some(Boolean);
          const sat = seen[row.key];
          const satCrop = sat?.cropId && CROP_BY_ID[sat.cropId];
          const set = (i, id) => onChange(row.key, crops.map((c, j) => (j === i ? id : c)));
          const remove = (i) => onChange(row.key, crops.filter((_, j) => j !== i));
          return (
            <div key={row.key} className="history-row">
              <div className="history-row__label">
                <strong>{row.label}</strong>
                <span className="num">{first - row.back}</span>
              </div>
              <div className="history-row__inputs">
                {crops.map((id, i) => (
                  <div className="history-row__crop" key={i}>
                    <label className="select">
                      <span className="visually-hidden">
                        Crop {i + 1}, {row.label.toLowerCase()}
                      </span>
                      <select className={`field__input select__input ${id ? '' : 'is-empty'}`} value={id} onChange={(e) => set(i, e.target.value)}>
                        <option value="">{satCrop && !typed ? `Not set (satellite: ${satCrop.name})` : 'Choose a crop…'}</option>
                        {CROPS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <Icon name="chevron-down" size={16} className="select__icon" />
                    </label>
                    {crops.length > 1 && <IconButton icon="close" size="sm" label={`Remove crop ${i + 1}`} onClick={() => remove(i)} />}
                  </div>
                ))}
                <button type="button" className="history-row__add" onClick={() => onChange(row.key, [...crops, ''])} disabled={!crops.at(-1)}>
                  <Icon name="plus" size={14} /> Add a second crop
                </button>
              </div>
              <div className="history-row__sat">
                {satCrop ? (
                  <>
                    <Icon name="satellite" size={14} />
                    <CropChip crop={satCrop} size="sm" />
                    <Badge tone={sat.confidence === 'low' ? 'neutral' : 'info'}>{CONF[sat.confidence]}</Badge>
                    {!typed && sat.confidence !== 'low' && <span className="history-row__used">Used by the plan</span>}
                  </>
                ) : (
                  <span className="muted small">No satellite reading</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
