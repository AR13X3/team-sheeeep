import Sparkline from './Sparkline.jsx';
import TimeLapse from './TimeLapse.jsx';
import SheepRunner from './SheepRunner.jsx';
import { Button, Card } from './ui.jsx';
import { CROP_BY_ID } from '../data/crops.js';
import { seasonWindow } from '../logic/phenology.js';
import { paddockSpace } from '../state/useSpace.js';

const CONF = { high: 'sure', medium: 'likely', low: 'best guess' };
const HISTORY_KEYS = ['last', 'prev', 'prev2'];

/**
 * "Seen from space": what NASA satellites saw growing on this paddock each season,
 * with a one-click way to use it as the crop history.
 */
export default function SpaceHistoryCard({ paddock, space, onApply }) {
  const { result, running, progress, error, start } = space;
  const mine = paddockSpace(result, paddock.id);

  if (!mine) {
    return (
      <Card className="space-card">
        <div className="space-card__head">
          <h2 className="card__title">Seen from space</h2>
          <span className="space-badge">NASA</span>
        </div>
        {running ? (
          <div className="status status--loading">
            <SheepRunner count={1} size={34} speed={1.8} className="runner-lane--mini" />
            <span>
              Reading NASA satellite images of your farm{progress.total ? ` (${progress.done} of ${progress.total})` : '…'}
            </span>
          </div>
        ) : (
          <>
            <p className="small">{error ? `Couldn’t read the satellite images: ${error}.` : 'See what grew here in past seasons, straight from NASA satellites.'}</p>
            <Button size="compact" icon="search" onClick={start}>
              {error ? 'Try again' : 'Look from space'}
            </Button>
          </>
        )}
      </Card>
    );
  }

  const canola = result.canola;
  const near = canola?.nearest?.[paddock.id];
  const applicable = HISTORY_KEYS.map((k) => mine.byHistoryKey[k]).filter((s) => s?.cropId);

  function apply() {
    const patch = {};
    HISTORY_KEYS.forEach((k) => {
      const s = mine.byHistoryKey[k];
      if (s?.cropId) patch[k] = [s.cropId];
    });
    onApply(patch);
  }

  return (
    <Card className="space-card">
      <div className="space-card__head">
        <h2 className="card__title">Seen from space</h2>
        <span className="space-badge" title={result.source}>
          NASA · {result.looks} images
        </span>
      </div>

      {near != null && near < 500 && (
        <p className="space-alert" role="note">
          <strong>Blackleg risk:</strong> canola flowered {near < 30 ? 'right next to' : `${near} m from`} this paddock in {canola.year}. Its stubble spreads blackleg spores up to ~500 m, so
          Manami will avoid canola here next season.
        </p>
      )}

      <ul className="space-seasons">
        {mine.seasons.map((s) => {
          const crop = s.cropId && CROP_BY_ID[s.cropId];
          const win = seasonWindow(s.year, result.lat);
          return (
            <li key={s.year}>
              <span className="space-seasons__year">
                {s.year}
                {!s.complete && <em> now</em>}
              </span>
              <div className="space-seasons__main">
                <div className="space-seasons__crop">
                  <span className="crop-chip">
                    {crop && <span className="crop-dot" style={{ background: crop.color }} />}
                    {s.label || 'Not enough clear images'}
                  </span>
                  {s.confidence && <span className={`conf conf--${s.confidence}`}>{CONF[s.confidence]}</span>}
                </div>
                <p className="space-seasons__why">{s.evidence || s.reason}</p>
              </div>
              <Sparkline series={s.series} start={win.start} end={win.end} color={crop?.color === '#d9c48f' ? '#9b7a2f' : '#5f6a2c'} label={`${s.year} greenness curve`} />
            </li>
          );
        })}
      </ul>

      <TimeLapse frames={result.frames} bbox={result.bbox} grid={[result.width, result.height]} coords={paddock.coords} />

      {applicable.length > 0 && (
        <div className="space-card__actions">
          <Button size="compact" icon="done" onClick={apply}>
            Use as crop history
          </Button>
          <span className="small muted">You can still correct each season below.</span>
        </div>
      )}
      <p className="source">
        NASA HLS v2.0 (Landsat + Sentinel-2, 30 m) via Microsoft Planetary Computer; pictures from Sentinel passes use the original 10 m Sentinel-2 image. Checked against USDA crop maps: canola found 85–96% of the time; crop type right
        78–88%. Cereal vs pulse is the least certain.
      </p>
    </Card>
  );
}
