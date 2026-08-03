const { computeNextOccurrence } = require('../../services/pems/recurrenceService');

describe('computeNextOccurrence', () => {
  const from = new Date('2026-08-03T10:00:00Z'); // Monday

  it('advances daily frequency by 1 day', () => {
    const next = computeNextOccurrence('DAILY', null, from);
    expect(next.getTime()).toBe(new Date('2026-08-04T10:00:00Z').getTime());
  });

  it('advances weekly frequency by 7 days', () => {
    const next = computeNextOccurrence('WEEKLY', null, from);
    expect(next.getTime()).toBe(new Date('2026-08-10T10:00:00Z').getTime());
  });

  it('advances monthly frequency by 1 month', () => {
    const next = computeNextOccurrence('MONTHLY', null, from);
    expect(next.getTime()).toBe(new Date('2026-09-03T10:00:00Z').getTime());
  });

  it('parses customCron via cron-parser for CUSTOM frequency', () => {
    const next = computeNextOccurrence('CUSTOM', '0 9 * * 1', from); // Mondays at 09:00 (local tz)
    // Next Monday after 2026-08-03T10:00 (already past 09:00) = 2026-08-10
    expect(next.getDay()).toBe(1);          // Monday
    expect(next.getMinutes()).toBe(0);      // :00
    expect(next > from).toBe(true);
    expect(next.getTime()).toBeGreaterThanOrEqual(new Date('2026-08-09T00:00:00Z').getTime());
  });

  it('falls back to frequency math when cron-parser is unavailable or cron is invalid', () => {
    const next = computeNextOccurrence('CUSTOM', 'not-a-cron', from);
    expect(next.getTime()).toBe(new Date('2026-08-10T10:00:00Z').getTime()); // default +7d
  });

  it('ignores customCron for non-CUSTOM frequencies', () => {
    const next = computeNextOccurrence('WEEKLY', '0 9 * * 1', from);
    expect(next.getTime()).toBe(new Date('2026-08-10T10:00:00Z').getTime());
  });
});
