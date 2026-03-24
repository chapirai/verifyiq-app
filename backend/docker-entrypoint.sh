#!/bin/sh
set -e

cd /app

echo "[entrypoint] Running pending database migrations..."
node -e "
var ds = require('./dist/data-source.js').AppDataSource;
ds.initialize()
  .then(function(initialized) {
    return initialized.runMigrations({ transaction: 'each' });
  })
  .then(function(ran) {
    if (ran.length === 0) {
      console.log('[entrypoint] No pending migrations.');
    } else {
      ran.forEach(function(m) {
        console.log('[entrypoint] Ran migration: ' + m.name);
      });
    }
    process.exit(0);
  })
  .catch(function(err) {
    console.error('[entrypoint] Migration failed:', err.message);
    process.exit(1);
  });
"

echo "[entrypoint] Starting VerifyIQ backend..."
exec node dist/main.js
