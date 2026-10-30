import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import TaskWorklist from '../../src/modules/tasks/components/TaskWorklist';
import '../../src/modules/tasks/task-instances.css';

const tasks = [
  { Id: 'task-one', Title: 'Check inventory availability', SellerName: 'Example Retail', TemplateName: 'Inventory monitoring', Status: 'IN_PROGRESS', Priority: 'HIGH', WeightedProgressPct: 0, ProgressPct: 75, DueDate: '2030-10-31T10:00:00Z' },
  { Id: 'task-two', Title: 'Correct listing evidence', SellerName: 'Example Retail', TemplateName: 'Listing quality', Status: 'REWORK', Priority: 'MEDIUM', ProgressPct: 40 },
];
function Fixture() {
  const mode = new URLSearchParams(window.location.search).get('state');
  const [error, setError] = useState(mode === 'error' ? 'Connection unavailable' : null);
  const [opened, setOpened] = useState(null);
  return <main className="worklist-page" style={{ fontFamily: 'Arial, sans-serif' }}>
    <h1>My tasks</h1>
    <TaskWorklist tasks={mode === 'empty' ? [] : tasks} loading={mode === 'loading'} error={error} onRetry={() => setError(null)} onOpen={setOpened} onReset={() => { window.location.search = ''; }} pagination={{ page: 1, limit: 25, total: mode === 'empty' ? 0 : 2, totalPages: 1 }} onPageChange={() => {}} onPageSizeChange={() => {}} />
    {opened && <section role="dialog" aria-label="Selected task"><h2>{opened.Title}</h2><button type="button" onClick={() => setOpened(null)}>Close</button></section>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
