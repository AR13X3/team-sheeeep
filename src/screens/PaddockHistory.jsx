import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import PaddockLayout from '../components/PaddockLayout.jsx';
import CropSeasonCard from '../components/CropSeasonCard.jsx';
import { SlopeCard, SoilCard } from '../components/SiteCards.jsx';
import { Button, Card, Checkbox, TextArea } from '../components/ui.jsx';
import { ISSUE_KEYS, usePaddock } from '../state/store.jsx';
import { useSiteData } from '../state/useSiteData.js';
import { useSpace } from '../state/useSpace.js';
import { useLoadingGate } from '../state/useLoadingGate.js';
import SpaceHistoryCard from '../components/SpaceHistoryCard.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { useEffect, useState } from 'react';
import '../styles/space.css';
import '../styles/screens.css';

const SEASONS = [
  { key: 'last', label: 'Last Season' },
  { key: 'prev', label: 'Last to Last Season' },
  { key: 'prev2', label: 'Last to Last to Last Season' },
];

/** "Each Paddock 1": crop history, soil, slope, known issues and comments. */
export default function PaddockHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { paddock, index, total, update, paddocks } = usePaddock(id);
  const status = useSiteData(paddock);
  const space = useSpace();
  const [skipped, setSkipped] = useState(false);
  // look the farm up from space as soon as the paddocks are known (cached after the first time)
  useEffect(() => {
    space.start();
  }, [space.start]);
  const showLoading = useLoadingGate(space.running && !space.result && !skipped) && !skipped;

  if (!paddock) return <Navigate to="/paddocks" replace />;
  const back = index === 0 ? '/paddocks/review' : `/paddocks/${paddocks[index - 1].id}/priorities`;

  return (
    <Screen scene="field-paddock" title="Paddock Details" step={3} stepNote={paddock.name} back={back} chat="history">
      <PaddockLayout
        paddock={paddock}
        index={index}
        total={total}
        step="history"
        overlay={space.result?.canola && { url: space.result.canola.overlay, bounds: [[space.result.bbox[1], space.result.bbox[0]], [space.result.bbox[3], space.result.bbox[2]]] }}
        overlayLabel={space.result?.canola && `Canola flowering ${space.result.canola.year} · seen from space`}
        actions={
          <Button iconEnd="arrow-forward" onClick={() => navigate(`/paddocks/${paddock.id}/priorities`)}>
            Next: Priorities
          </Button>
        }
      >
        <SpaceHistoryCard paddock={paddock} space={space} onApply={(patch) => update((p) => ({ history: { ...p.history, ...patch } }))} />

        {SEASONS.map((s) => (
          <CropSeasonCard
            key={s.key}
            label={s.label}
            value={paddock.history[s.key]}
            onChange={(crops) => update((p) => ({ history: { ...p.history, [s.key]: crops } }))}
          />
        ))}

        <SoilCard paddock={paddock} status={status} />
        <SlopeCard paddock={paddock} status={status} />

        <Card title="Known Issues" className="check-card">
          <div className="check-list">
            {ISSUE_KEYS.map((issue) => (
              <Checkbox
                key={issue.key}
                label={issue.label}
                checked={paddock.issues[issue.key]}
                onChange={(checked) => update((p) => ({ issues: { ...p.issues, [issue.key]: checked } }))}
              />
            ))}
          </div>
        </Card>

        <Card title="Comments">
          <TextArea label={`Comments about ${paddock.name}`} value={paddock.comments} onChange={(e) => update({ comments: e.target.value })} />
        </Card>

      </PaddockLayout>
      {showLoading && (
        <LoadingScreen
          title="Looking back from space"
          detail={`Reading NASA satellite images of your farm over the last 5 seasons${space.progress.total ? ` (${space.progress.done} of ${space.progress.total})` : '…'}`}
          progress={space.progress.total ? space.progress.done / space.progress.total : 0.02}
          action={
            <Button tone="secondary" size="compact" onClick={() => setSkipped(true)}>
              Keep going in the background
            </Button>
          }
        />
      )}
    </Screen>
  );
}
