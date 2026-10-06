import { Check, Loader2 } from 'lucide-react';

const STRIP_LEAD = (label) => label.replace(/^[✓●]+\s*/, '').trim();

const TOOL_LABELS = {
  content_priority: {
    running: 'Scoring content optimization urgency',
    done: 'Scored content optimization urgency',
  },
  database_query: {
    running: 'Querying RetailOps database',
    done: 'Queried RetailOps database',
  },
};

export const buildSteps = ({ inFlight, receivedTool, firstChunk, toolName }) => {
  const done = ({ label, detail }) => ({ label: STRIP_LEAD(label), detail, status: 'done' });
  const labels = TOOL_LABELS[toolName] || TOOL_LABELS.database_query;

  const steps = [{ label: 'Understanding request', status: 'done' }];

  if (receivedTool) {
    steps.push({
      label: inFlight ? labels.running : labels.done,
      status: 'done',
    });
  } else if (inFlight) {
    steps.push({ label: labels.running, status: 'running' });
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