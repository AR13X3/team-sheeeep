import { useNavigate, useSearchParams } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import CropSetPicker from '../components/CropSetPicker.jsx';
import { Button, Card } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { DEFAULT_FARM } from '../logic/cropSet.js';
import '../styles/screens.css';

/** "About you", part 2: livestock and the crops the farm can grow. `?back=/planner` when opened from the menu. */
export default function YourFarm() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const back = params.get('back');
  const farm = state.farm ?? DEFAULT_FARM;

  return (
    <Screen scene="field" title="Your Farm" step={0} stepNote="Your crops" back={back || '/experience'} chat="farm">
      <div className="farm-stage">
        <Card className="farm-card">
          <h2 className="farm-card__title">What does your farm grow?</h2>
          <p className="farm-card__lead">Manami only plans with what you tick. You can change it any time from the Planner.</p>
          <CropSetPicker
            farm={farm}
            onChange={(value) => dispatch({ type: 'setFarm', value })}
            action={
              <Button iconEnd={back ? undefined : 'arrow-forward'} icon={back ? 'done' : undefined} onClick={() => navigate(back || '/paddocks')}>
                {back ? 'Done' : 'Continue'}
              </Button>
            }
          />
        </Card>
      </div>
    </Screen>
  );
}
