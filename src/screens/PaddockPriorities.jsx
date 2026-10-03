import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import PaddockLayout from '../components/PaddockLayout.jsx';
import Slider from '../components/Slider.jsx';
import { PricesCard } from '../components/SiteCards.jsx';
import { Button, Card, Checkbox } from '../components/ui.jsx';
import { PRIORITY_KEYS, REASON_KEYS, usePaddock, useStore } from '../state/store.jsx';
import { useSiteData } from '../state/useSiteData.js';
import { planPaddock } from '../logic/rotation.js';
import { useSpace } from '../state/useSpace.js';
import { withSpace } from '../logic/spacePlanning.js';
import { allowedCrops } from '../logic/cropSet.js';
import '../styles/screens.css';

const priorityLevel = (v) => (v === 0 ? 'Not important' : v < 30 ? 'Low' : v <= 70 ? 'Medium' : v < 100 ? 'High' : 'Top priority');

/** "Each Paddock 2": priorities, reasons for rotating, prices. */
export default function PaddockPriorities() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { paddock, index, total, update, paddocks } = usePaddock(id);
  useSiteData(paddock);

  // The plan for this paddock with the current settings: drives the live preview under the
  // sliders and the Prices card, so farmers see the effect of every change straight away.
  const space = useSpace();
  const { state } = useStore();
  const crops = useMemo(() => allowedCrops(state.farm), [state.farm]);
  const preview = useMemo(() => (paddock ? planPaddock(withSpace(paddock, space.result), 6, crops).seasons : []), [paddock, space.result, crops]);
  const likelyCrops = useMemo(() => [...new Set(preview.map((s) => s.crop.id))].slice(0, 4), [preview]);

  if (!paddock) return <Navigate to="/paddocks" replace />;
  const next = index < total - 1 ? `/paddocks/${paddocks[index + 1].id}/history` : '/planner';

  return (
    <Screen scene="field-paddock" title="Paddock Details" step={3} stepNote={paddock.name} back={`/paddocks/${paddock.id}/history`} chat="priorities">
      <PaddockLayout
        paddock={paddock}
        index={index}
        total={total}
        step="priorities"
        actions={
          <Button iconEnd={index < total - 1 ? 'arrow-forward' : undefined} icon={index < total - 1 ? undefined : 'done'} onClick={() => navigate(next)}>
            {index < total - 1 ? `Next: ${paddocks[index + 1].name}` : 'Done: See my plan'}
          </Button>
        }
      >
        <Card title="Priorities" className="priorities">
          {PRIORITY_KEYS.map((p) => (
            <div key={p.key} className="priority">
              <p className="priority__label">
                {p.label} <span className="priority__level">{priorityLevel(paddock.priorities[p.key])}</span>
              </p>
              <Slider
                label={p.label}
                value={paddock.priorities[p.key]}
                valueText={priorityLevel}
                ends={['Less', 'More']}
                onChange={(v) => update((q) => ({ priorities: { ...q.priorities, [p.key]: v } }))}
              />
            </div>
          ))}
          {preview[0]?.note && <p className="plan-list__note">{preview[0].note}</p>}
          <div className="plan-preview" aria-live="polite">
            <span className="plan-preview__label">Next seasons with these settings</span>
            <ol>
              {preview.slice(0, 4).map((s, i) => (
                <li key={i}>
                  <span className="crop-dot" style={{ background: s.crop.color }} />
                  {s.crop.name}
                </li>
              ))}
            </ol>
          </div>
        </Card>

        <Card title="Main Reason for Crop Rotating" className="check-card">
          <div className="check-list">
            {REASON_KEYS.map((r) => (
              <Checkbox
                key={r.key}
                label={r.label}
                checked={paddock.reasons[r.key]}
                onChange={(checked) => update((q) => ({ reasons: { ...q.reasons, [r.key]: checked } }))}
              />
            ))}
          </div>
        </Card>

        <PricesCard cropIds={likelyCrops} />

      </PaddockLayout>
    </Screen>
  );
}
