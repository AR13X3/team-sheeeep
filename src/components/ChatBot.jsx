import { useEffect, useRef, useState } from 'react';
import Art from './Art.jsx';
import Icon from './Icon.jsx';
import { MASCOT_NAME } from '../config.js';
import { reply, SCREEN_TIPS } from '../logic/manami.js';
import { useStore } from '../state/store.jsx';
import '../styles/chatbot.css';

const QUICK_REPLY = 'Yes! I have a question!';

/** "Chat Bot" component set: a prompt + Manami launcher that opens a chat window. */
export default function ChatBot({ screen }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([{ from: 'bot', text: 'Have a question?' }]);
  const [showQuick, setShowQuick] = useState(true);
  const [tipShown, setTipShown] = useState(false);
  const log = useRef(null);
  const input = useRef(null);

  const tip = SCREEN_TIPS[screen];
  const tipId = `tip:${screen}`;
  // New farmers get a tip per screen. It waits in Manami's chip instead of covering the page.
  const hasTip = !!tip && state.experience === 'new' && !state.dismissedTips[tipId];

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  function openChat() {
    if (hasTip) {
      setMessages((m) => [{ from: 'bot', text: `Tip: ${tip}` }, ...m]);
      setTipShown(true);
      dispatch({ type: 'dismissTip', id: tipId });
    }
    setOpen(true);
  }

  function send(text) {
    const clean = text.trim();
    if (!clean) return;
    setMessages((m) => [...m, { from: 'me', text: clean }]);
    setShowQuick(false);
    setDraft('');
    setTyping(true);
    let answer = reply(clean, screen);
    if (clean === QUICK_REPLY) {
      answer = 'Great! Ask me anything about outlining paddocks, soil, slope, rainfall or crop rotations.';
      if (tip && !tipShown) answer += `\n\nTip for this screen: ${tip}`;
    }
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { from: 'bot', text: answer }]);
    }, 450 + Math.min(900, answer.length * 6));
  }

  if (!open) {
    return (
      <div className="chatbot">
        <button
          type="button"
          className={`chatbot__launcher ${hasTip ? 'has-tip' : ''}`}
          onClick={openChat}
          aria-label={hasTip ? `${MASCOT_NAME} has a tip for this screen` : `Ask ${MASCOT_NAME} a question`}
        >
          <span className="chatbot__prompt">{hasTip ? 'I have a tip!' : 'Have a Question?'}</span>
          <span className="chatbot__avatar">
            <Art name="manami" />
            {hasTip && <span className="chatbot__badge" aria-hidden="true" />}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="chatbot chatbot--open">
      <section className="chat" aria-label={`Chat with ${MASCOT_NAME}`}>
        <header className="chat__header">
          <span className="chat__avatar">
            <Art name="manami" />
          </span>
          <h2 className="chat__name">{MASCOT_NAME}</h2>
          <button type="button" className="chat__close" onClick={() => setOpen(false)} aria-label="Close chat">
            <Icon name="close" size={26} />
          </button>
        </header>
        <div className="chat__log" ref={log} aria-live="polite">
          {messages.map((m, i) => (
            <p key={i} className={`chat__msg chat__msg--${m.from}`}>
              {m.text}
            </p>
          ))}
          {typing && (
            <p className="chat__msg chat__msg--bot chat__typing" aria-label={`${MASCOT_NAME} is typing`}>
              <span />
              <span />
              <span />
            </p>
          )}
          {showQuick && (
            <button type="button" className="btn btn--chat chat__quick" onClick={() => send(QUICK_REPLY)}>
              {QUICK_REPLY}
            </button>
          )}
        </div>
        <form
          className="chat__form"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <label className="field">
            <span className="visually-hidden">Message</span>
            <input ref={input} className="field__input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Ask ${MASCOT_NAME}…`} />
          </label>
        </form>
      </section>
    </div>
  );
}
