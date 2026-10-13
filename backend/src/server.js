// Entry point: `npm start` runs this file.
const config = require('./config');
const { createDatabase } = require('./db/database');
const { createApp } = require('./app');

const db = createDatabase(config.dbPath);
const app = createApp({ db, corsOrigins: config.corsOrigins });

const server = app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}  (db: ${config.dbPath})`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Cannot start the API: port ${config.port} is already in use.`);
    console.error('Stop the existing Turia backend or set PORT in backend/.env to another available port.');
  } else {
    console.error('Cannot start the API:', err);
  }
  db.close();
  process.exitCode = 1;
});

// Close cleanly on Ctrl+C so SQLite flushes everything to disk.
function shutdown() {
  console.log('\nShutting down...');
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
