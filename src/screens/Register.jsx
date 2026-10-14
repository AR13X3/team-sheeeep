import { useNavigate } from 'react-router-dom';
import Page from '../components/Page.jsx';
import PaddockTable from '../components/PaddockTable.jsx';
import { Button, Card, EmptyState, Kpi } from '../components/ui.jsx';
import { useFarm } from '../state/useFarm.js';
import '../styles/pages.css';
import '../styles/dashboard.css';

/** Every paddock in one sortable table, with farm totals on top. */
export default function Register() {
  const farm = useFarm();
  const navigate = useNavigate();
  const { paddocks, plans, totalHa } = farm;

  const actions = (
    <>
      <Button tone="ghost" icon="mountain" onClick={() => navigate('/paddocks/review')} disabled={!paddocks.length}>
        Soil check
      </Button>
      <Button icon="plus" onClick={() => navigate('/paddocks?draw=1')}>
        Draw paddock
      </Button>
    </>
  );

  if (!paddocks.length)
    return (
      <Page title="Paddocks" description="Every paddock on the farm with its soil, history and plan." actions={actions} tip="register">
        <Card>
          <EmptyState icon="paddocks" title="No paddocks yet" action={<Button icon="plus" onClick={() => navigate('/paddocks?draw=1')}>Draw your first paddock</Button>}>
            Outline paddocks on the Farm map and they’ll appear here with their soil, history and plan.
          </EmptyState>
        </Card>
      </Page>
    );

  const base = Math.round(paddocks.reduce((s, p) => s + plans[p.id].base, 0) / paddocks.length);
  const textures = new Set(paddocks.map((p) => p.site?.soil?.texture).filter(Boolean));
  const withHistory = paddocks.filter((p, i) => ['last', 'prev', 'prev2'].some((k) => farm.planned[i].history?.[k]?.some(Boolean))).length;

  return (
    <Page wide title="Paddocks" description="Every paddock on the farm with its soil, history and plan. Click a row to open it." actions={actions} tip="register">
      <div className="grid-4">
        <Kpi label="Paddocks" icon="paddocks" value={paddocks.length}>
          <p className="kpi__foot">{totalHa.toFixed(1)} ha in total</p>
        </Kpi>
        <Kpi label="Average size" icon="map" value={totalHa / paddocks.length} decimals={1} unit="ha" />
        <Kpi label="Soil health today" icon="leaf" value={base} unit="/ 100">
          <p className="kpi__foot">Farm average from soil carbon, pH and issues</p>
        </Kpi>
        <Kpi label="Crop history known" icon="history" value={withHistory} unit={`of ${paddocks.length}`}>
          <p className="kpi__foot">{textures.size ? `${textures.size} soil type${textures.size > 1 ? 's' : ''}: ${[...textures].join(', ')}` : 'Soil types loading'}</p>
        </Kpi>
      </div>
      <Card flush>
        <PaddockTable farm={farm} />
      </Card>
    </Page>
  );
}
