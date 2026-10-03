// The five stages of the onboarding flow, shown under the screen title.
export const FLOW_STEPS = ['About you', 'Paddocks', 'Soil check', 'Paddock details', 'Your plan'];

export default function FlowSteps({ step, note }) {
  const label = `Step ${step + 1} of ${FLOW_STEPS.length}`;
  return (
    <div className="steps">
      <ol className="steps__bars" aria-label={`${label}: ${FLOW_STEPS[step]}`}>
        {FLOW_STEPS.map((name, i) => (
          <li key={name} className={i < step ? 'is-done' : i === step ? 'is-current' : ''} title={name} aria-current={i === step ? 'step' : undefined}>
            <span className="visually-hidden">{name}</span>
          </li>
        ))}
      </ol>
      <span className="steps__label">
        {label}
        {note && <span className="steps__note"> · {note}</span>}
      </span>
    </div>
  );
}
