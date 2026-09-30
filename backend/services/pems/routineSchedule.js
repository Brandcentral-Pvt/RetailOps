/**
 * Pure scheduling helpers for daily-routine templates. No I/O — unit tested.
 *
 * A sub-task definition may carry `schedule`:
 *   { weekdays?: number[],          // 0=Sun … 6=Sat; omitted = every run day
 *     dayOfMonthFrom?: number,      // inclusive
 *     dayOfMonthTo?: number }       // inclusive
 * It is only evaluated when an instance is generated for a specific date (recurrence);
 * tasks created by hand always get every sub-task.
 */

const DEFAULT_RUN_DAYS = [1, 2, 3, 4, 5, 6];           // Mon–Sat
const DEFAULT_DUE_TIME = '18:00';
const WORKDAY_END = '19:00';
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseRunDays(value) {
  if (Array.isArray(value)) value = value.join(',');
  if (value === null || value === undefined || String(value).trim() === '') return DEFAULT_RUN_DAYS.slice();
  const days = String(value).split(',').map(s => parseInt(s.trim(), 10)).filter(n => n >= 0 && n <= 6);
  return days.length ? [...new Set(days)].sort((a, b) => a - b) : DEFAULT_RUN_DAYS.slice();
}

function parseHHmm(value, fallback = DEFAULT_DUE_TIME) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  const ok = m && +m[1] <= 23 && +m[2] <= 59;
  const s = ok ? `${String(+m[1]).padStart(2, '0')}:${m[2]}` : fallback;
  const [h, min] = s.split(':').map(Number);
  return { text: s, hours: h, minutes: min };
}

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function nextMidnight(d) { const x = startOfDay(d); x.setDate(x.getDate() + 1); return x; }

function runsOn(runDays, date) { return parseRunDays(runDays).includes(new Date(date).getDay()); }

/** Does a sub-task (by its `schedule`) apply on this date? No schedule → always. */
function subTaskApplies(schedule, date) {
  if (!schedule || typeof schedule !== 'object') return true;
  const d = new Date(date);
  if (Array.isArray(schedule.weekdays) && schedule.weekdays.length && !schedule.weekdays.includes(d.getDay())) return false;
  const dom = d.getDate();
  if (schedule.dayOfMonthFrom && dom < schedule.dayOfMonthFrom) return false;
  if (schedule.dayOfMonthTo && dom > schedule.dayOfMonthTo) return false;
  return true;
}

function filterSubTasksForDate(defs, date) {
  return (defs || []).filter(st => subTaskApplies(st && st.schedule, date));
}

/**
 * When is today's occurrence due?
 * If the due time already passed when we generate (new template installed mid-day), fall back
 * to the end of the workday so the person still gets a fair chance; if even that is gone, skip.
 * @returns {Date|null}
 */
function dueAtFor(date, dueTime, now = new Date(), workdayEnd = WORKDAY_END) {
  const t = parseHHmm(dueTime);
  const due = startOfDay(date); due.setHours(t.hours, t.minutes, 0, 0);
  if (due > now) return due;
  const w = parseHHmm(workdayEnd, WORKDAY_END);
  const end = startOfDay(date); end.setHours(w.hours, w.minutes, 0, 0);
  return end > now ? end : null;
}

/**
 * Best-effort reading of a sub-task title: "Weekly …", "… (Monday & Thursday)", "twice a week",
 * "monthly …", "first 10 days of the month". Returns a schedule or null (= every day).
 * This only pre-fills the importer preview; the trainer can change it afterwards.
 */
function inferSchedule(title) {
  const t = String(title || '').toLowerCase();
  if (!t) return null;
  const named = DAY_NAMES.map((n, i) => (t.includes(n) ? i : -1)).filter(i => i >= 0);
  if (named.length) return { weekdays: named };
  if (/twice\s+(a|per)\s+week|2\s*x\s*(a\s*)?week|bi-?weekly\s+report/.test(t)) return { weekdays: [1, 4] };
  const first = /first\s+(\d{1,2})\s+days?/.exec(t);
  if (first) return { dayOfMonthTo: Math.min(31, +first[1]) };
  if (/\bmonthly\b/.test(t)) return { weekdays: [1], dayOfMonthTo: 7 };
  if (/\bweekly\b/.test(t)) return { weekdays: [1] };
  return null;
}

function describeSchedule(schedule) {
  if (!schedule) return 'Every day';
  const parts = [];
  if (schedule.weekdays && schedule.weekdays.length) {
    parts.push(schedule.weekdays.map(d => DAY_NAMES[d].slice(0, 3)).map(s => s[0].toUpperCase() + s.slice(1)).join(' & '));
  }
  if (schedule.dayOfMonthFrom || schedule.dayOfMonthTo) {
    parts.push(`day ${schedule.dayOfMonthFrom || 1}–${schedule.dayOfMonthTo || 31} of month`);
  }
  return parts.length ? parts.join(', ') : 'Every day';
}

module.exports = {
  DEFAULT_RUN_DAYS, DEFAULT_DUE_TIME, WORKDAY_END, DAY_NAMES,
  parseRunDays, parseHHmm, startOfDay, nextMidnight, runsOn,
  subTaskApplies, filterSubTasksForDate, dueAtFor, inferSchedule, describeSchedule,
};
