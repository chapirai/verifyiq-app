#!/bin/sh
set -e

cd /app

echo "[entrypoint] Running pending database migrations..."
node -e "
var ds = require('./dist/data-source.js').AppDataSource;
function formatMigrationError(err) {
  try {
    if (!err) return 'Unknown migration error (empty error object)';
    if (typeof err === 'string') return err;
    var parts = [];
    if (err.name) parts.push('name=' + err.name);
    if (err.message) parts.push('message=' + err.message);
    if (err.code) parts.push('code=' + err.code);
    if (err.detail) parts.push('detail=' + err.detail);
    if (err.hint) parts.push('hint=' + err.hint);
    if (err.where) parts.push('where=' + err.where);
    if (err.table) parts.push('table=' + err.table);
    if (err.column) parts.push('column=' + err.column);
    if (err.constraint) parts.push('constraint=' + err.constraint);
    if (err.query) parts.push('query=' + err.query);
    if (err.parameters) parts.push('parameters=' + JSON.stringify(err.parameters));
    if (err.driverError) {
      parts.push('driverError=' + JSON.stringify({
        message: err.driverError.message,
        code: err.driverError.code,
        detail: err.driverError.detail,
        hint: err.driverError.hint,
        where: err.driverError.where,
        table: err.driverError.table,
        column: err.driverError.column,
        constraint: err.driverError.constraint
      }));
    }
    if (err.stack) parts.push('stack=' + err.stack);
    return parts.length ? parts.join(' | ') : JSON.stringify(err);
  } catch (formatErr) {
    return 'Failed to format migration error: ' + String(formatErr);
  }
}
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
    console.error('[entrypoint] Migration failed:', formatMigrationError(err));
    process.exit(1);
  });
"

echo "[entrypoint] Starting VerifyIQ backend..."
exec node dist/main.js
