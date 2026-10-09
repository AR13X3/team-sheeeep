import { CROPS } from '../data/crops.js';
import { CROP_GROUPS, cropSetWarnings, describeCropSet, isTicked } from '../logic/cropSet.js';
import Icon from './Icon.jsx';
import '../styles/cropset.css';

const ALL_IDS = CROPS.map((c) => c.id);

/**
 * The farm's crop list: livestock yes/no plus a tick for every crop the farmer can grow and sell.
 * Used on the setup step, in Settings and in the Planner's "Your crops" dialog. `onChange` gets a
 * partial farm ({ livestock } or { crops }). `action` (e.g. a Continue button) sits beside the warnings.
 */
export default function CropSetPicker({ farm, onChange, action }) {
  const noLivestock = farm.livestock === false;
  const setCrops = (ids) => onChange({ crops: ids.length === ALL_IDS.length ? null : ids });
  const toggle = (id) => {
    const current = farm.crops ?? ALL_IDS;
    setCrops(current.includes(id) ? current.filter((x) => x !== id) : ALL_IDS.filter((x) => x === id || current.includes(x)));
  };
  const warnings = cropSetWarnings(farm);

  return (
    <div className="crop-set">
      <section className="crop-set__section">
        <h3 className="crop-set__q" id="q-livestock">
          <span className="crop-set__num">1</span> Do you keep livestock?
        </h3>
        <div className="choice-pair" role="radiogroup" aria-labelledby="q-livestock">
          <button type="button" role="radio" aria-checked={noLivestock} className="choice" onClick={() => onChange({ livestock: false })}>
            <span className="choice__icon">
              <Icon name="wheat" size={18} />
            </span>
            <span>
              <strong>Crops only</strong>
              <span>No sheep or cattle, so no pasture phases</span>
            </span>
          </button>
          <button type="button" role="radio" aria-checked={!noLivestock} className="choice" onClick={() => onChange({ livestock: true })}>
            <span className="choice__icon">
              <Icon name="sprout" size={18} />
            </span>
            <span>
              <strong>Crops + livestock</strong>
              <span>Pasture phases can be grazed</span>
            </span>
          </button>
        </div>
      </section>

      <section className="crop-set__section">
        <div className="crop-set__head">
          <h3 className="crop-set__q">
            <span className="crop-set__num">2</span> Which crops can you grow and sell?
          </h3>
          <span className="crop-set__quick">
            <button type="button" onClick={() => setCrops(ALL_IDS)}>
              Tick all
            </button>
            <button type="button" onClick={() => setCrops([])}>
              Clear
            </button>
          </span>
        </div>
        <div className="crop-set__groups">
          {CROP_GROUPS.map((g) => {
            const list = CROPS.filter((c) => c.family === g.family);
            const on = list.filter((c) => isTicked(farm, c.id) && !(c.needsLivestock && noLivestock)).length;
            return (
              <div key={g.family} className="crop-set__group">
                <p className="crop-set__group-label">
                  {g.label}
                  <span>
                    {on}/{list.length}
                  </span>
                  {g.livestock && noLivestock && <em className="crop-set__note">Needs livestock</em>}
                </p>
                <div className="crop-set__chips">
                  {list.map((c) => {
                    const blocked = c.needsLivestock && noLivestock;
                    const ticked = isTicked(farm, c.id) && !blocked;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`crop-toggle${ticked ? ' is-on' : ''}`}
                        aria-pressed={ticked}
                        disabled={blocked}
                        title={blocked ? 'Needs livestock to graze it' : undefined}
                        onClick={() => toggle(c.id)}
                      >
                        <span className="crop-toggle__box" aria-hidden="true">
                          {ticked && <Icon name="check" size={12} strokeWidth={3} />}
                        </span>
                        <span className="crop-dot" style={{ background: c.color }} />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="crop-set__foot">
        <div className="crop-set__status">
          {warnings.length > 0 && (
            <div className="crop-set__warn" role="status">
              {warnings.map((w) => (
                <p key={w}>
                  <Icon name="alert" size={14} /> {w}
                </p>
              ))}
            </div>
          )}
          <p className="crop-set__summary">
            <Icon name="circle-check" size={14} /> Planning with {describeCropSet(farm)}.
          </p>
        </div>
        {action}
      </div>
    </div>
  );
}
