const express = require('express');
const { getPublicDefinitions } = require('../config/agentDefinitions');

// GET /api/agent-definitions: lets the frontend build its form from the same
// definitions the server validates against, so the two can never drift apart.
function definitionRoutes() {
  const router = express.Router();
  router.get('/', (req, res) => res.json({ success: true, data: getPublicDefinitions() }));
  return router;
}
module.exports = { definitionRoutes };
