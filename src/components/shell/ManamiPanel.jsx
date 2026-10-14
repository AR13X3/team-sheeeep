import { useEffect, useRef, useState } from 'react';
import Art from '../Art.jsx';
import Icon from '../Icon.jsx';
import { IconButton } from '../ui.jsx';
import { MASCOT_NAME } from '../../config.js';
import { reply, SCREEN_TIPS } from '../../logic/manami.js';
import { useStore } from '../../state/store.jsx';

// Suggested questions per page (each matches one of Manami's answers in logic/manami.js).
const SUGGEST = {
  dashboard: ['Did my rotation work?', 'What is blackleg?', 'How is soil health worked out?'],
  paddocks: ['How do I draw a paddock?', 'What does snapping do?', 'Is my data saved?'],
  register: ['How is soil health worked out?', 'What is blackleg?'],
  review: ['Why split a paddock?', 'Where does the soil data come from?'],
  paddock: ['Why rotate crops?', 'How is the sowing window worked out?'],
  history: ['How do you see crops from space?', 'What does best guess mean?'],
  conditions: ['What does soil pH mean?', 'How is slope measured?', 'Where does rainfall come from?'],
  priorities: ['Why rotate crops?', 'Are the prices live?', 'What do legumes do?'],
  planner: ['How do I read the season grid?', 'How is the sowing window worked out?', 'What is blackleg?'],
  insights: ['Did my rotation work?', 'How do you see crops from space?'],
  settings: ['Is my data saved?', 'How do I export my plan?'],
  experience: ['What can you do?'],
  farm: ['Which crops should I tick?', 'Do I need livestock?'],
};

// The conversation survives closing the panel and moving between pages.
let conversation = [{ from: 'bot', text: `Hi, I’m ${MASCOT_NAME}! Ask me anything about your paddocks, the data or the plan.` }];

/** Manami docked on the right: tips for this page, suggested questions and a chat box. */
export default function ManamiPanel({ screen, prompt, onClose }) {
  const { state, dispatch } = useStore();
  const [messages, setMessages] = useState(conversation);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const log = useRef(null);
  const input = useRef(null);
  const tip = SCREEN_TIPS[screen];
  const tipId = `tip:${screen}`;

  useEffect(() => {
    conversation = messages;
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return; // once per opening (dev mode runs effects twice)
    opened.current = true;
    // a waiting tip for this page is shown first
    if (tip && state.experience === 'new' && !state.dismissedTips[tipId]) {
      setMessages((m) => [...m, { from: 'bot', text: tip, tip: true }]);
      dispatch({ type: 'dismissTip', id: tipId });
    }
    if (prompt) send(prompt);
    else input.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function send(text) {
    const clean = text.trim();
    if (!clean) return;
    setMessages((m) => [...m, { from: 'me', text: clean }]);
    setDraft('');
    setTyping(true);
    const answer = reply(clean, screen);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { from: 'bot', text: answer }]);
    }, 400 + Math.min(800, answer.length * 5));
  }

  return (
    <aside className="manami" aria-label={`Chat with ${MASCOT_NAME}`}>
      <header className="manami__head">
        <span className="manami__face">
          <Art name="manami" />
        </span>
        <div className="manami__who">
          <h2>{MASCOT_NAME}</h2>
          <p>
            <span className="manami__online" /> Farm assistant · answers offline
          </p>
        </div>
        <IconButton icon="close" label="Close" onClick={onClose} />
      </header>
      <div className="manami__log" ref={log} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble--${m.from}${m.tip ? ' bubble--tip' : ''}`}>
            {m.tip && (
              <span className="bubble__tag">
                <Icon name="sparkles" size={12} /> Tip for this page
              </span>
            )}
            {m.text}
          </div>
        ))}
        {typing && (
          <div className="bubble bubble--bot bubble--typing" aria-label={`${MASCOT_NAME} is typing`}>
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <div className="manami__suggest">
        {(SUGGEST[screen] || SUGGEST.dashboard).map((s) => (
          <button key={s} type="button" onClick={() => send(s)} disabled={typing}>
            {s}
          </button>
        ))}
      </div>
      <form
        className="manami__form"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label className="visually-hidden" htmlFor="manami-input">
          Message
        </label>
        <input id="manami-input" ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Ask ${MASCOT_NAME}…`} autoComplete="off" />
        <button type="submit" className="manami__send" aria-label="Send" disabled={!draft.trim()}>
          <Icon name="send" size={16} />
        </button>
      </form>
    </aside>
  );
}
