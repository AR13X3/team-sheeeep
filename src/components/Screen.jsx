import { useNavigate } from 'react-router-dom';
import Scene from './Scene.jsx';
import ChatBot from './ChatBot.jsx';
import AppMenu from './AppMenu.jsx';
import { RoundButton, TitleTab } from './ui.jsx';
import FlowSteps from './FlowSteps.jsx';
import '../styles/screen.css';

/**
 * Every frame in the design shares this chrome: animated background, back button
 * (top-left), title tab (top-centre), optional menu (top-right) and Manami (bottom-right).
 */
export default function Screen({ scene = 'field', title, step, stepNote, back, menu = false, chat, className = '', children }) {
  const navigate = useNavigate();
  return (
    <div className={`screen ${className}`}>
      <Scene name={scene} />
      {back && <RoundButton icon="arrow-back" label="Back" className="screen__back" onClick={() => navigate(back)} />}
      {title && <TitleTab steps={step != null && <FlowSteps step={step} note={stepNote} />}>{title}</TitleTab>}
      {menu && <AppMenu />}
      <main className="screen__main">{children}</main>
      {chat && <ChatBot screen={chat} />}
    </div>
  );
}
