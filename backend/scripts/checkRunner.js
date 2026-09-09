require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const playwrightScraperRunner = require('../services/playwrightScraperRunner');

const jobs = playwrightScraperRunner.getAllJobs();
console.log('Active runner jobs:', jobs.length);
jobs.forEach(job => {
    console.log(`  ${job.jobId}: ${job.status} - ${job.processed}/${job.total} (${job.successful} success, ${job.failed} failed) - ${job.progress}%`);
});

const stats = playwrightScraperRunner.getStats();
console.log('\nRunner Stats:');
console.log(stats);