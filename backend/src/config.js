// Central place that reads environment variables. Everything else imports
// from here, so there is exactly one place to look for configuration.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const backendRoot = path.join(__dirname, '..');

const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Resolve relative DB paths against backend/ so it works from any cwd.
  dbPath: path.resolve(backendRoot, process.env.DB_PATH || './data/agent_center.db'),
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

module.exports = config;
