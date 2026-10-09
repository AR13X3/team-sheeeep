import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PaddockLayout from '../components/PaddockLayout.jsx';
import CropHistoryCard from '../components/CropSeasonCard.jsx';
import SpaceHistoryCard from '../components/SpaceHistoryCard.jsx';
import { Button, Card, TextArea } from '../components/ui.jsx';
import { ISSUE_KEYS, usePaddock } from '../state/store.jsx';
import { useSpace, paddockSpace } from '../state/useSpace.js';
import { useToast } from '../state/toast.jsx';
import '../styles/paddock.css';

/** History tab: satellite record, the last three seasons, known issues and notes. */
export default function PaddockHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { paddock, index, total, update } = usePaddock(id);
  const space = useSpace();

  if (!paddock) return <Navigate to="/register" replace />;
  const seen = paddockSpace(space.result, paddock.id)?.byHistoryKey || {};
  const canola = space.result?.canola;

  return (
    <PaddockLayout
      paddock={paddock}
      index={index}
      total={total}
      step="history"
      overlay={canola && { url: canola.overlay, bounds: [[space.result.bbox[1], space.result.bbox[0]], [space.result.bbox[3], space.result.bbox[2]]] }}
      overlayLabel={canola && `Canola flowering ${canola.year} · seen from space`}
      action={
        <Button iconEnd="arrow-forward" onClick={() => navigate(`/paddocks/${paddock.id}/priorities`)}>
          Next: Priorities
        </Button>
      }
    >
      <SpaceHistoryCard
        paddock={paddock}
        space={space}
        onApply={(patch) => {
          update((p) => ({ history: { ...p.history, ...patch } }));
          toast({ tone: 'ok', icon: 'satellite', title: 'Crop history filled from space', description: `${Object.keys(patch).length} seasons set for ${paddock.name}. Correct any season below.` });
        }}
      />

      <CropHistoryCard history={paddock.history} seen={seen} onChange={(key, crops) => update((p) => ({ history: { ...p.history, [key]: crops } }))} />

      <Card title="Known issues" subtitle="Tick anything that affects this paddock. The plan favours crops that cope with it." icon="alert">
        <div className="chip-group">
          {ISSUE_KEYS.map((issue) => (
            <button key={issue.key} type="button" className="chip-toggle" aria-pressed={!!paddock.issues[issue.key]} onClick={() => update((p) => ({ issues: { ...p.issues, [issue.key]: !p.issues[issue.key] } }))}>
              {issue.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Notes" icon="file">
        <TextArea label={`Notes about ${paddock.name}`} hideLabel value={paddock.comments} onChange={(e) => update({ comments: e.target.value })} placeholder="Anything worth remembering: soil tests, wet corners, fence plans…" />
      </Card>
    </PaddockLayout>
  );
}
