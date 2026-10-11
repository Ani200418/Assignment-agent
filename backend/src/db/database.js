// Opens the SQLite file and makes sure the tables exist.
// createDatabase(path) is a factory so tests can pass ':memory:' or a temp
// file and never touch the real demo database.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function createDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);

  // SQLite does NOT enforce foreign keys unless asked, per connection.
  db.pragma('foreign_keys = ON');
  // WAL = better concurrency and crash-safety for a file database.
  if (dbPath !== ':memory:') db.pragma('journal_mode = WAL');

  // Create tables/indexes if missing (idempotent).
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  return db;
}

module.exports = { createDatabase };
