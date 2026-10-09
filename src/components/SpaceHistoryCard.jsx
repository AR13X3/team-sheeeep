import Sparkline from './Sparkline.jsx';
import TimeLapse from './TimeLapse.jsx';
import Icon from './Icon.jsx';
import { Badge, Button, Card, CropChip, Progress, Source } from './ui.jsx';
import { CROP_BY_ID } from '../data/crops.js';
import { seasonWindow } from '../logic/phenology.js';
import { paddockSpace } from '../state/useSpace.js';

const CONF = { high: 'Sure', medium: 'Likely', low: 'Best guess' };
const CONF_TONE = { high: 'ok', medium: 'info', low: 'neutral' };
const HISTORY_KEYS = ['last', 'prev', 'prev2'];

// "NDVI 0.53" reads as jargon: say greenness, keep the index name in the tooltip.
const plain = (text = '') => text.replace(/NDVI /g, 'greenness ');

/**
 * "Seen from space": what NASA satellites saw growing on this paddock each season,
 * with a one-click way to use it as the crop history.
 */
export default function SpaceHistoryCard({ paddock, space, onApply }) {
  const { result, running, progress, error, start } = space;
  const mine = paddockSpace(result, paddock.id);
  const head = { title: 'Seen from space', subtitle: 'What NASA satellites saw growing here each season', icon: 'satellite' };

  if (!mine) {
    return (
      <Card {...head} actions={<Badge tone="info">NASA HLS</Badge>}>
        {running ? (
          <div className="space-wait">
            <p>
              Reading NASA satellite images of your farm
              <span className="num">{progress.total ? ` · ${progress.done} of ${progress.total}` : '…'}</span>
            </p>
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 4} tone="teal" label="Satellite images read" />
            <p className="muted small">This takes about 30 seconds the first time and is cached afterwards. You can keep working.</p>
          </div>
        ) : (
          <div className="space-wait">
            <p>{error ? `Couldn’t read the satellite images: ${error}.` : 'See what grew here in past seasons, straight from NASA satellites.'}</p>
            <div>
              <Button size="sm" icon={error ? 'refresh' : 'satellite'} onClick={start}>
                {error ? 'Try again' : 'Look from space'}
              </Button>
            </div>
          </div>
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
    <Card
      {...head}
      actions={
        <Badge tone="info" title={result.source}>
          NASA · {result.looks} images
        </Badge>
      }
      className="space-card"
    >
      {near != null && near < 500 && (
        <p className="callout callout--bad space-alert" role="note">
          <Icon name="alert" size={16} />
          <span>
            <strong>Blackleg risk:</strong> canola flowered {near < 30 ? 'right next to' : `${near} m from`} this paddock in {canola.year}. Its stubble spreads blackleg spores up to ~500 m, so the plan avoids canola here next season.
          </span>
        </p>
      )}

      <ul className="space-seasons">
        {mine.seasons.map((s) => {
          const crop = s.cropId && CROP_BY_ID[s.cropId];
          const win = seasonWindow(s.year, result.lat);
          return (
            <li key={s.year}>
              <span className="space-seasons__year num">
                {s.year}
                {!s.complete && <em>now</em>}
              </span>
              <div className="space-seasons__main">
                <div className="space-seasons__crop">
                  <CropChip crop={crop} size="sm">
                    {s.label || 'Not enough clear images'}
                  </CropChip>
                  {s.confidence && <Badge tone={CONF_TONE[s.confidence]}>{CONF[s.confidence]}</Badge>}
                </div>
                <p className="space-seasons__why" title={s.evidence || s.reason}>
                  {plain(s.evidence || s.reason)}
                </p>
              </div>
              <Sparkline series={s.series} start={win.start} end={win.end} color={crop?.color === '#d9c48f' ? '#9b7a2f' : '#5f6a2c'} label={`${s.year} greenness curve`} />
            </li>
          );
        })}
      </ul>

      <TimeLapse frames={result.frames} bbox={result.bbox} grid={[result.width, result.height]} coords={paddock.coords} />

      {applicable.length > 0 && (
        <div className="space-card__actions">
          <Button size="sm" icon="done" onClick={apply}>
            Use as crop history
          </Button>
          <span className="small muted">You can still correct each season below.</span>
        </div>
      )}
      <Source>
        NASA HLS v2.0 (Landsat + Sentinel-2, 30 m) via Microsoft Planetary Computer; pictures from Sentinel passes use the original 10 m Sentinel-2 image. Checked against USDA crop maps: canola found 85–96% of the time; crop type right 78–88%. Cereal vs pulse is the least certain.
      </Source>
    </Card>
  );
}
