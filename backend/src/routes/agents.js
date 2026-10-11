const express = require('express');
const { createAgentController } = require('../controllers/agentController');

function agentRoutes(db) {
  const router = express.Router();
  const c = createAgentController(db);
  router.get('/', c.list);
  router.post('/', c.create);
  router.get('/:id/history', c.historyForAgent);
  router.post('/:id/publish', c.publish);
  router.post('/:id/disable', c.disable);
  router.post('/:id/test-run', c.testRun);
  router.get('/:id', c.get);
  router.put('/:id', c.update);
  return router;
}
module.exports = { agentRoutes };
