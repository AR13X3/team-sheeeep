import { Navigate, useParams } from 'react-router-dom';
import PaddockLayout from '../components/PaddockLayout.jsx';
import { ClimateCard, SoilCard, TerrainCard } from '../components/SiteCards.jsx';
import Icon from '../components/Icon.jsx';
import { usePaddock } from '../state/store.jsx';
import { useSiteData } from '../state/useSiteData.js';
import { baseSoilHealth } from '../logic/rotation.js';
import '../styles/paddock.css';

/** Conditions tab: soil, slope and climate, filled in from public datasets. */
export default function PaddockConditions() {
  const { id } = useParams();
  const { paddock, index, total } = usePaddock(id);
  const status = useSiteData(paddock);
  if (!paddock) return <Navigate to="/register" replace />;
  const base = baseSoilHealth(paddock);

  return (
    <PaddockLayout paddock={paddock} index={index} total={total} step="conditions">
      <p className="callout">
        <Icon name="leaf" size={16} />
        <span>
          Starting soil health for {paddock.name} is <strong>{base} / 100</strong>, worked out from organic carbon and pH below, minus any known issues you ticked.
        </span>
      </p>
      <div className="grid-2">
        <SoilCard paddock={paddock} status={status} />
        <TerrainCard paddock={paddock} status={status} />
      </div>
      <ClimateCard paddock={paddock} status={status} />
    </PaddockLayout>
  );
}
