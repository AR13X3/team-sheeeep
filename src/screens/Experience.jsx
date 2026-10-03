import { useNavigate } from 'react-router-dom';
import Screen from '../components/Screen.jsx';
import { Button, Card } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import '../styles/screens.css';

export default function Experience() {
  const { dispatch } = useStore();
  const navigate = useNavigate();

  const choose = (value) => {
    dispatch({ type: 'setExperience', value });
    navigate('/farm');
  };

  return (
    <Screen scene="field" title="About You" step={0} back="/" chat="experience">
      <div className="center-stage">
        <Card className="experience">
          <h2 className="experience__title">What is your Farming Experience?</h2>
          <div className="experience__actions">
            <div className="experience__option">
              <Button tone="primary" iconEnd="arrow-forward" onClick={() => choose('new')} aria-describedby="exp-new">
                New Farmer
              </Button>
              <p id="exp-new">Manami walks you through each step with tips.</p>
            </div>
            <div className="experience__option">
              <Button tone="secondary" iconEnd="arrow-forward" onClick={() => choose('experienced')} aria-describedby="exp-pro">
                Experienced Farmer
              </Button>
              <p id="exp-pro">No tips — straight to the tools. Manami is still there if you ask.</p>
            </div>
          </div>
        </Card>
      </div>
    </Screen>
  );
}
