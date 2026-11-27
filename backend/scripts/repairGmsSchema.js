/* Read-only by default; --apply runs the additive, idempotent GMS migration. */
const { ensureGmsSchema } = require('../database/gmsSchema');
(async () => {
  try {
    const state = await ensureGmsSchema({ apply: process.argv.includes('--apply') });
    console.log(JSON.stringify(state, null, 2));
    if (!state.ready) {
      console.error('GMS schema is not ready. Check database compatibility and missing objects.');
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('GMS schema check/repair failed:', error.message);
    process.exit(1);
  }
})();
