import React from 'react';
import { ArrowRight, CalendarDays, Check, ClipboardList, RotateCw, SearchX, AlertCircle } from 'lucide-react';
import { WORKFLOW_STATUSES } from '../constants';
import { taskDue, taskNextAction, taskProgress } from '../utils/taskListPresentation';

function TaskRow({ task, onOpen, showOwner }) {
  const progress = taskProgress(task);
  const action = taskNextAction(task);
  const due = taskDue(task);
  const done = task.Status === 'APPROVED';
  const reviewing = ['SUBMITTED', 'UNDER_REVIEW', 'RESUBMITTED'].includes(task.Status);
  const rework = ['REWORK', 'REJECTED', 'ESCALATED'].includes(task.Status);
  const tone = done ? 'done' : reviewing ? 'review' : rework ? 'attention' : task.Status === 'IN_PROGRESS' ? 'progress' : 'neutral';
  return (
    <li className="worklist-row" data-task-id={task.Id}>
      <div className={`worklist-task-icon worklist-task-icon--${tone}`} aria-hidden="true">{done ? <Check size={18} /> : <ClipboardList size={18} />}</div>
      <div className="worklist-task">
        <button type="button" className="worklist-task-title" onClick={() => onOpen(task)}>{task.Title || task.TemplateName || 'Untitled task'}</button>
        <div className="worklist-task-meta"><span>{task.SellerName || 'General task'}</span><span aria-hidden="true">·</span><span>{task.TemplateName || task.TemplateCode || task.InstanceCode}</span>{showOwner && task.AssigneeName && <><span aria-hidden="true">·</span><span>{task.AssigneeName}</span></>}</div>
        <p className="worklist-next-step">{action.hint}</p>
      </div>
      <div className="worklist-status-cell"><span className={`worklist-status worklist-status--${tone}`}><span aria-hidden="true" />{WORKFLOW_STATUSES[task.Status]?.label || task.Status || 'Unknown status'}</span>{['CRITICAL', 'HIGH'].includes(task.Priority) && <span className={`worklist-priority worklist-priority--${task.Priority.toLowerCase()}`}>{task.Priority === 'CRITICAL' ? 'Critical priority' : 'High priority'}</span>}</div>
      <div className="worklist-progress-cell"><div className="worklist-progress-label"><span>Progress</span><strong>{progress}%</strong></div><div className="worklist-progress-track" role="progressbar" aria-label={`${task.Title || 'Task'} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div></div>
      <div className={`worklist-due worklist-due--${due.tone}`}><span><CalendarDays size={13} aria-hidden="true" />{due.label}</span>{due.detail && <small>{due.detail}</small>}</div>
      <button type="button" className="worklist-open" aria-label={`${action.label}: ${task.Title || task.TemplateName || 'task'}`} onClick={() => onOpen(task)}>{action.label}<ArrowRight size={14} aria-hidden="true" /></button>
    </li>
  );
}

export default function TaskWorklist({ tasks, loading, error, onRetry, onOpen, showOwner, grouped, emptyTitle, emptyDescription, onReset, pagination, onPageChange, onPageSizeChange }) {
  const groups = grouped ? Object.entries(tasks.reduce((result, task) => { const name = task.SellerName || 'General tasks'; (result[name] ||= []).push(task); return result; }, {})) : [['', tasks]];
  const start = (pagination.page - 1) * pagination.limit + 1;
  return (
    <section className="worklist-panel" aria-label="Task list" aria-busy={loading}>
      <div className="worklist-panel-heading"><div><span className="worklist-section-label">YOUR WORKSPACE</span><h2>Task list <span>{pagination.total}</span></h2></div><span className="worklist-panel-note">Open a task to see its activities and required evidence.</span></div>
      {error ? <div className="worklist-state" role="alert"><AlertCircle size={28} /><h3>We couldn’t load your tasks</h3><p>{error}</p><button className="worklist-button" type="button" onClick={onRetry}><RotateCw size={14} />Try again</button></div> : loading ? <div className="worklist-skeleton" role="status" aria-label="Loading tasks">{[0, 1, 2, 3, 4].map(i => <div key={i}><span /><div><span /><span /></div><span /></div>)}</div> : !tasks.length ? <div className="worklist-state"><SearchX size={30} /><h3>{emptyTitle || 'No tasks in this view'}</h3><p>{emptyDescription || 'Try another status or adjust your filters.'}</p><button type="button" className="worklist-button" onClick={onReset}>Reset view</button></div> : <>
        <div className="worklist-column-headings" aria-hidden="true"><span /><span>Task & next step</span><span>Status</span><span>Progress</span><span>Due</span><span /></div>
        {groups.map(([name, rows]) => <div key={name}>{name && <h3 className="worklist-group-heading">{name}<span>{rows.length} on this page</span></h3>}<ul className="worklist-rows">{rows.map(task => <TaskRow key={task.Id} task={task} onOpen={onOpen} showOwner={showOwner} />)}</ul></div>)}
      </>}
      {!error && pagination.total > 0 && <footer className="worklist-pagination"><span role="status" aria-live="polite">{loading ? 'Loading tasks…' : `${start}–${Math.min(start + tasks.length - 1, pagination.total)} of ${pagination.total} tasks`}</span><div><label>Per page <select value={pagination.limit} onChange={e => onPageSizeChange(Number(e.target.value))} disabled={loading}>{[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label><button type="button" aria-label="Previous page" onClick={() => onPageChange(pagination.page - 1)} disabled={loading || pagination.page <= 1}>Previous</button><span>{pagination.page} / {pagination.totalPages || 1}</span><button type="button" aria-label="Next page" onClick={() => onPageChange(pagination.page + 1)} disabled={loading || pagination.page >= pagination.totalPages}>Next</button></div></footer>}
    </section>
  );
}
