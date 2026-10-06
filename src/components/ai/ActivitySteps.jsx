import { Check, Loader2 } from 'lucide-react';

const STRIP_LEAD = (label) => label.replace(/^[✓●]+\s*/, '').trim();

export const buildSteps = ({ inFlight, receivedTool, firstChunk }) => {
  const done = ({ label, detail }) => ({ label: STRIP_LEAD(label), detail, status: 'done' });

  const steps = [{ label: 'Understanding request', status: 'done' }];

  if (receivedTool) {
    steps.push({
      label: inFlight ? 'Querying RetailOps database' : 'Queried RetailOps database',
      status: 'done',
    });
  } else if (inFlight) {
    steps.push({ label: 'Querying RetailOps database', status: 'running' });
  }

  if (firstChunk) {
    steps.push({ label: 'Generating recommendations', status: inFlight ? 'done' : 'running' });
  }

  if (!inFlight) {
    steps.forEach((s, i) => {
      if (s.status === 'running') steps[i] = { ...s, status: 'done' };
    });
    if (!receivedTool) steps.push({ label: 'Compiling response', status: 'done' });
  }

  return steps.map(done);
};

const ActivitySteps = ({ steps, durationMs, collapsed }) => {
  if (!steps || !steps.length) return null;

  const shown = collapsed ? steps.slice(0, 1) : steps;

  return (
    <div className="ai-ws__activity">
      <div className="ai-ws__activity-title">Operations</div>
      {shown.map((s) => (
        <div key={s.label} className="ai-ws__activity-step">
          {s.status === 'done' ? (
            <Check size={13} className="ai-ws__check" />
          ) : (
            <Loader2 size={13} className="ai-ws__spinner animate-spin" />
          )}
          <span>
            {s.label}
            {s.detail ? <span style={{ opacity: 0.7 }}> · {s.detail}</span> : null}
          </span>
        </div>
      ))}
      {durationMs != null ? (
        <div className="ai-ws__count">
          {steps.length} {steps.length === 1 ? 'operation' : 'operations'} completed ·{' '}
          {(durationMs / 1000).toFixed(1)}s
        </div>
      ) : null}
    </div>
  );
};

export default ActivitySteps;