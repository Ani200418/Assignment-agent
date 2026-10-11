// Shared test helpers. Not a test file itself (name does not end in .test.js).
const fs = require('fs');
const os = require('os');
const path = require('path');

// A throw-away database folder so tests can NEVER touch backend/data/agent_center.db.
function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-center-test-'));
  return { dir, file: path.join(dir, 'test.db'), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

const SAMPLES = {
  Task: { trigger: 'Task due soon', conditions: { daysBeforeDue: 3 } },
  DSC: { trigger: 'DSC expiry approaching', conditions: { daysBeforeExpiry: 30 } },
  License: { trigger: 'License expiry approaching', conditions: { daysBeforeExpiry: 45 } },
};

// A valid agent body for the given module; override any top-level field or config field.
function validAgent(module = 'Task', { config = {}, ...overrides } = {}) {
  return {
    name: `${module} test agent`,
    module,
    description: 'Created by an automated test.',
    config: { ...SAMPLES[module], recipient: 'Assigned user', channel: 'Email', action: 'Send notification', message: 'Hello from a test.', ...config },
    ...overrides,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { tempDb, validAgent, sleep, MODULES: ['Task', 'DSC', 'License'] };
