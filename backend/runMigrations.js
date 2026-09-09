const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: '31.97.62.95',
  database: 'retailops',
  user: 'sa',
  password: 'YourStrong@Passw0rd',
  port: 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function runMigrations() {
  try {
    await sql.connect(config);
    console.log('Connected to SQL Server');
    
    const migrationFiles = [
      '008_critical_covering_indexes.sql',
      '009_taskflow_phase1_schema.sql',
      '010_taskflow_phase2_escalation_notifications.sql',
      '011_taskflow_phase3_subtasks_reviews.sql'
    ];
    
    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, 'migrations', file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      
      // Split by GO statements (SQL Server batch separator)
      const batches = sqlContent.split(/\bGO\b/ig).filter(b => b.trim());
      
      console.log('Running ' + file + ' (' + batches.length + ' batches)...');
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i].trim();
        if (batch) {
          try {
            await new sql.Request().query(batch);
            console.log('  Batch ' + (i + 1) + '/' + batches.length + ' executed');
          } catch (err) {
            console.error('  Batch ' + (i + 1) + ' failed:', err.message);
          }
        }
      }
      console.log(file + ' completed\n');
    }
    
    console.log('All migrations completed!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.close();
  }
}

runMigrations();