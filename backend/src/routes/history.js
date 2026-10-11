const express = require('express');
const { createAgentService } = require('../services/agentService');
const { createExecutionService } = require('../services/executionService');

function historyRoutes(db) {
  const router = express.Router();
  const executions = createExecutionService(db, createAgentService(db));
  router.get('/', (req, res) => {
    const limit = typeof req.query.limit === 'string' ? req.query.limit : undefined;
    res.json({ success: true, data: executions.list(limit) });
  });
  return router;
}
module.exports = { historyRoutes };
