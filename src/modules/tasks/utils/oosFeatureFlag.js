/**
 * OOS-RECON-001 feature flag (D10).
 *
 * Per-template and per-task feature flag, default off.
 * When enabled for the OOS-RECON-001 template, the specialized SharedTaskShell
 * is used instead of TaskWorkspace. TaskWorkspace remains the immediate
 * fallback; flag-off restores it without a deploy.
 *
 * Storage: localStorage key 'oos_recon_v1_enabled' with value:
 *   - 'all'      - flag on for all OOS-RECON-001 tasks
 *   - 'none'     - flag off for all tasks (default)
 *   - '<taskId>' - flag on for a specific task instance ID
 *
 * The flag is read on every check (no caching), so toggling takes effect
 * immediately without a redeploy.
 */

const STORAGE_KEY = 'oos_recon_v1_enabled';
const OOS_TEMPLATE_CODE = 'OOS-RECON-001';

/**
 * Check whether the OOS specialized view is enabled for a given task.
 *
 * @param {object} task - Task instance with TemplateCode or templateCode
 * @returns {boolean} true if the OOS view should be used
 */
export function isOosViewEnabled(task) {
  if (!task) return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return false;

  const templateCode = task.TemplateCode || task.templateCode || '';
  const taskId = task.Id || task.id || '';

  // Only OOS-RECON-001 template tasks are eligible
  if (templateCode !== OOS_TEMPLATE_CODE) return false;

  if (stored === 'all') return true;
  if (stored === 'none') return false;
  if (stored === taskId) return true;

  return false;
}

/**
 * Enable the OOS view for all OOS-RECON-001 tasks.
 */
export function enableOosViewAll() {
  localStorage.setItem(STORAGE_KEY, 'all');
}

/**
 * Enable the OOS view for a specific task instance.
 */
export function enableOosViewTask(taskId) {
  localStorage.setItem(STORAGE_KEY, taskId);
}

/**
 * Disable the OOS view (restore TaskWorkspace for all tasks).
 */
export function disableOosView() {
  localStorage.setItem(STORAGE_KEY, 'none');
}

/**
 * Get the current flag state for display/debugging.
 */
export function getOosViewFlagState() {
  return localStorage.getItem(STORAGE_KEY) || 'none';
}
