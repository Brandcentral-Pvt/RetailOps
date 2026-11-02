import React from 'react';
import SharedTaskShell from './SharedTaskShell';

export default function TaskViewResolver({ open, onClose, task, onRefresh }) {
  if (!open) return null;

  // Use the new SharedTaskShell for all tasks
  return (
    <SharedTaskShell
      open={open}
      onClose={onClose}
      taskId={task?.Id}
      onRefresh={onRefresh}
    />
  );
}