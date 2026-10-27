/**
 * TaskViewResolver — Phase 8 (D10)
 *
 * Resolves which task drawer shell to render:
 *   - When the OOS-RECON-001 feature flag is ON for this task → SharedTaskShell
 *   - Otherwise → TaskWorkspace (generic fallback)
 *
 * The flag is per-template and per-task, default off. Flag-off restores
 * TaskWorkspace without a redeploy.
 */
import React, { useEffect, useState } from 'react';
import TaskWorkspace from './TaskWorkspace';
import SharedTaskShell from './SharedTaskShell';
import { isOosViewEnabled } from '../utils/oosFeatureFlag';

export default function TaskViewResolver({ open, onClose, task, onRefresh }) {
  const [useOosShell, setUseOosShell] = useState(false);

  // Re-evaluate the flag whenever the task or open state changes
  useEffect(() => {
    setUseOosShell(isOosViewEnabled(task));
  }, [task, open]);

  if (!open) return null;

  if (useOosShell) {
    return (
      <SharedTaskShell
        open={open}
        onClose={onClose}
        taskId={task?.Id}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <TaskWorkspace
      open={open}
      onClose={onClose}
      taskId={task?.Id}
      onRefresh={onRefresh}
    />
  );
}
