import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PaddockLayout from '../components/PaddockLayout.jsx';
import Slider from '../components/Slider.jsx';
import Icon from '../components/Icon.jsx';
import { PricesCard } from '../components/SiteCards.jsx';
import { Button, Card } from '../components/ui.jsx';
import { PRIORITY_KEYS, REASON_KEYS, usePaddock, useStore } from '../state/store.jsx';
import { planPaddock } from '../logic/rotation.js';
import { useSpace } from '../state/useSpace.js';
import { withSpace } from '../logic/spacePlanning.js';
import { allowedCrops } from '../logic/cropSet.js';
import { seasonYears } from '../logic/seasons.js';
import '../styles/paddock.css';

const priorityLevel = (v) => (v === 0 ? 'Not important' : v < 30 ? 'Low' : v <= 70 ? 'Medium' : v < 100 ? 'High' : 'Top priority');

/** Priorities tab: what matters most here, why the farmer rotates, with a live preview of the plan. */
export default function PaddockPriorities() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { paddock, index, total, update, paddocks } = usePaddock(id);
  const { state, dispatch } = useStore();
  const space = useSpace();
  const crops = useMemo(() => allowedCrops(state.farm), [state.farm]);
  const years = useMemo(() => seasonYears(6), []);
  // The plan for this paddock with the current settings drives the preview and the prices,
  // so farmers see the effect of every change straight away.
  const preview = useMemo(() => (paddock ? planPaddock(withSpace(paddock, space.result), 6, crops).seasons : []), [paddock, space.result, crops]);
  const likelyCrops = useMemo(() => [...new Set(preview.map((s) => s.crop.id))].slice(0, 4), [preview]);

  if (!paddock) return <Navigate to="/register" replace />;
  const last = index === total - 1;
  const next = last ? '/planner' : `/paddocks/${paddocks[index + 1].id}/history`;

  function go() {
    if (last) dispatch({ type: 'completeStep', step: 'details' });
    navigate(next);
  }

  return (
    <PaddockLayout
      paddock={paddock}
      index={index}
      total={total}
      step="priorities"
      action={
        <Button iconEnd={last ? undefined : 'arrow-forward'} icon={last ? 'done' : undefined} onClick={go}>
          {last ? 'Done: see my plan' : `Next: ${paddocks[index + 1].name}`}
        </Button>
      }
    >
      <div className="split">
        <Card title="Priorities" subtitle="Slide each one to show what matters most on this paddock." icon="target" className="priorities">
          <div className="priorities-grid">
            {PRIORITY_KEYS.map((p) => (
              <div key={p.key} className="priority">
                <p className="priority__label">
                  <span>
                    {p.label}
                    <span className="priority__hint"> · {p.hint}</span>
                  </span>
                  <span className="priority__level">{priorityLevel(paddock.priorities[p.key])}</span>
                </p>
                <Slider label={p.label} value={paddock.priorities[p.key]} valueText={priorityLevel} ends={['Less', 'More']} onChange={(v) => update((q) => ({ priorities: { ...q.priorities, [p.key]: v } }))} />
              </div>
            ))}
          </div>
        </Card>
        <Card title="Live preview" subtitle="The next seasons with these settings" icon="sparkles">
          <div className="plan-preview" aria-live="polite">
            <ol>
              {preview.slice(0, 4).map((s, i) => (
                <li key={`${i}-${s.crop.id}`}>
                  <span className="num">{years[i]}</span>
                  <span className="plan-preview__crop">
                    <span className="crop-dot" style={{ background: s.crop.color }} />
                    {s.crop.name}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {preview[0]?.note && (
            <p className="callout callout--warn plan-note plan-list__note">
              <Icon name="alert" size={16} />
              <span>{preview[0].note}</span>
            </p>
          )}
        </Card>
      </div>

      <Card title="Why do you rotate crops here?" subtitle="Tick every reason that applies. Each one nudges the crop choice." icon="flag" className="check-card">
        <div className="chip-group">
          {REASON_KEYS.map((r) => (
            <button key={r.key} type="button" className="chip-toggle" aria-pressed={!!paddock.reasons[r.key]} onClick={() => update((q) => ({ reasons: { ...q.reasons, [r.key]: !q.reasons[r.key] } }))}>
              {r.label}
            </button>
          ))}
        </div>
      </Card>

      <PricesCard cropIds={likelyCrops} />
    </PaddockLayout>
  );
}
