import { useNavigate } from 'react-router-dom';
import Page from '../components/Page.jsx';
import Art from '../components/Art.jsx';
import Icon from '../components/Icon.jsx';
import { Card } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import '../styles/pages.css';

const OPTIONS = [
  {
    value: 'new',
    title: 'New farmer',
    art: 'sheep-3',
    text: 'Manami walks you through each step with a short tip on every page.',
    points: ['Tips on every page', 'Plain-language explanations', 'Suggested next steps'],
  },
  {
    value: 'experienced',
    title: 'Experienced farmer',
    art: 'sheep-1',
    text: 'No tips, straight to the tools. Manami is still there when you ask.',
    points: ['Dense, data-first views', 'Keyboard shortcuts (Ctrl K)', 'Tips available on request'],
  },
];

export default function Experience() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();

  const choose = (value) => {
    dispatch({ type: 'setExperience', value });
    dispatch({ type: 'completeStep', step: 'about' });
    navigate('/farm');
  };

  return (
    <Page eyebrow="Getting started" title={`Welcome${state.user?.name && state.user.name !== 'Guest' ? `, ${state.user.name}` : ''}`} description="Two quick questions about you and your farm, then we’ll map your paddocks." step="about">
      <Card title="How much farming experience do you have?" subtitle="This only changes how much guidance you see. You can switch any time in Settings.">
        <div className="option-grid" role="radiogroup" aria-label="Farming experience">
          {OPTIONS.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={state.experience === o.value} className="option" onClick={() => choose(o.value)}>
              <Art name={o.art} className="option__art" />
              <span className="option__body">
                <strong className="option__title">{o.title}</strong>
                <span className="option__text">{o.text}</span>
                <ul className="option__points">
                  {o.points.map((p) => (
                    <li key={p}>
                      <Icon name="check" size={14} /> {p}
                    </li>
                  ))}
                </ul>
              </span>
              <Icon name="arrow-forward" size={18} className="option__go" />
            </button>
          ))}
        </div>
      </Card>
    </Page>
  );
}
