/* CLI: node backend/scripts/extractAsinIssueLabels.js
 * Regenerates backend/__tests__/fixtures/asinIssueLabels.json from the live
 * `Asins` table.
 *
 * The fixture is the ground truth for asinIssueClassifier: it holds every
 * distinct `TitleIssues` label the analyser has ever produced, with occurrence
 * counts, so the classifier's coverage is asserted against reality rather than
 * against hand-written examples that can drift from the feed.
 *
 * Read-only. Commit the regenerated file alongside any change to the analyser's
 * output format so the coverage test fails loudly when a new message appears.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getPool } = require('../database/db');

const OUT = path.join(__dirname, '..', '__tests__', 'fixtures', 'asinIssueLabels.json');

async function main() {
  const pool = await getPool();

  const labels = await pool.request().query(`
    SELECT j.[value] AS label, COUNT_BIG(*) AS n
    FROM Asins a CROSS APPLY OPENJSON(a.TitleIssues) j
    WHERE a.TitleIssues IS NOT NULL
      AND LTRIM(RTRIM(a.TitleIssues)) NOT IN ('', '[]')
    GROUP BY j.[value]
    ORDER BY n DESC, j.[value] ASC
  `);

  const grades = await pool.request().query(`
    SELECT TitleGrade AS grade, COUNT_BIG(*) AS n
    FROM Asins
    WHERE TitleGrade IS NOT NULL AND LTRIM(RTRIM(TitleGrade)) <> ''
    GROUP BY TitleGrade
  `);

  const out = {
    _note:
      'Real TitleIssues labels extracted from Asins. Regenerate with: node scripts/extractAsinIssueLabels.js',
    extractedFor: 'asinIssueClassifier',
    labels: labels.recordset.map(r => ({ label: r.label, n: Number(r.n) })),
    grades: grades.recordset.map(r => ({ grade: r.grade, n: Number(r.n) })),
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  const total = out.labels.reduce((s, x) => s + x.n, 0);
  console.log(`Wrote ${out.labels.length} distinct labels (${total} occurrences) to ${path.relative(process.cwd(), OUT)}`);
  console.log(`Grades: ${out.grades.map(g => `${g.grade}=${g.n}`).join(', ')}`);

  await pool.close();
}

main().catch(err => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
