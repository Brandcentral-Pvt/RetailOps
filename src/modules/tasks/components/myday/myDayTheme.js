/**
 * Shared visual language for My Day.
 *
 * Every value here is a token *reference*, never a literal: these strings are
 * handed straight to inline custom properties (`--md-accent`) and to
 * `background`, so they resolve against :root (and `body.bc-dark`) instead of
 * freezing the palette at build time. See src/modules/tasks/myday.css.
 */

export const PRIORITY_ACCENT = {
  CRITICAL: 'var(--bc-red-600)',
  HIGH: 'var(--bc-amber-600)',
  MEDIUM: 'var(--bc-primary-600)',
  LOW: 'var(--bc-slate-400)',
};

/** Accents for the two slot kinds that are not a task. */
export const REVIEW_ACCENT = 'var(--md-review)';
export const BREAK_ACCENT = 'var(--md-break)';

export const accentFor = (task) => PRIORITY_ACCENT[task?.Priority] || PRIORITY_ACCENT.MEDIUM;