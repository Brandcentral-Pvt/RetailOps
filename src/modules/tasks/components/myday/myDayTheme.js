// Shared visual language for My Day.
export const PRIORITY_COLOR = { CRITICAL: '#D32F2F', HIGH: '#ED6C02', MEDIUM: '#1976D2', LOW: '#94a3b8' };
export const accentFor = (task) => PRIORITY_COLOR[task?.Priority] || PRIORITY_COLOR.MEDIUM;
