import { useNavigate, useSearchParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import CropSetPicker from '../components/CropSetPicker.jsx';
import { Button, Card } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { DEFAULT_FARM } from '../logic/cropSet.js';
import '../styles/pages.css';

/** Setup step 2: livestock and the crops the farm can grow. `?back=/planner` when opened from elsewhere. */
export default function YourFarm() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = params.get('back');
  const farm = state.farm ?? DEFAULT_FARM;

  function done() {
    dispatch({ type: 'completeStep', step: 'crops' });
    navigate(back || '/paddocks');
  }

  return (
    <Page
      eyebrow={back ? 'Farm settings' : 'Getting started'}
      title="Crops and livestock"
      description="Manami only plans with what you tick. You can change this any time."
      step={back ? undefined : 'crops'}
      tip="farm"
      actions={
        back ? (
          <Button tone="ghost" icon="arrow-back" onClick={() => navigate(back)}>
            Back
          </Button>
        ) : (
          <Button tone="ghost" icon="arrow-back" onClick={() => navigate('/experience')}>
            Back
          </Button>
        )
      }
    >
      <Card className="farm-card">
        <CropSetPicker
          farm={farm}
          onChange={(value) => dispatch({ type: 'setFarm', value })}
          action={
            <Button size="lg" iconEnd={back ? undefined : 'arrow-forward'} icon={back ? 'done' : undefined} onClick={done}>
              {back ? 'Done' : 'Continue to farm map'}
            </Button>
          }
        />
      </Card>
    </Page>
  );
}
