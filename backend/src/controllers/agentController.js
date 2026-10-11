// Translates HTTP <-> services. No SQL and no business rules here.
// Errors are thrown as HttpError and turned into JSON by middleware/errorHandler.
const { createAgentService } = require('../services/agentService');
const { createExecutionService } = require('../services/executionService');
const { HttpError } = require('../middleware/errorHandler');

// Strict: only "1", "42", ... (rejects "abc", "1.5", "1e2", "0", "-3", "0x10").
function parseId(raw) {
  const text = String(raw);
  const id = Number(text);
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(id)) {
    throw new HttpError(400, 'INVALID_ID', 'Agent id must be a positive whole number.');
  }
  return id;
}

const notFound = () => new HttpError(404, 'NOT_FOUND', 'Agent not found.');
const queryText = (v) => (typeof v === 'string' ? v : '');

function createAgentController(db) {
  const agents = createAgentService(db);
  const executions = createExecutionService(db, agents);

  return {
    list(req, res) {
      const data = agents.list({
        module: queryText(req.query.module) || null,
        status: queryText(req.query.status) || null,
        search: queryText(req.query.search),
      });
      res.json({ success: true, data });
    },
    create(req, res) {
      res.status(201).json({ success: true, data: agents.create(req.body) });
    },
    get(req, res) {
      const agent = agents.get(parseId(req.params.id));
      if (!agent) throw notFound();
      res.json({ success: true, data: agent });
    },
    update(req, res) {
      const agent = agents.update(parseId(req.params.id), req.body);
      if (!agent) throw notFound();
      res.json({ success: true, data: agent });
    },
    publish(req, res) {
      const agent = agents.publish(parseId(req.params.id));
      if (!agent) throw notFound();
      res.json({ success: true, data: agent });
    },
    disable(req, res) {
      const agent = agents.disable(parseId(req.params.id));
      if (!agent) throw notFound();
      res.json({ success: true, data: agent });
    },
    // 201 = a run record was created. Check data.status ('success' | 'failed') for the simulation outcome.
    testRun(req, res) {
      const run = executions.run(parseId(req.params.id));
      if (!run) throw notFound();
      res.status(201).json({ success: true, data: run });
    },
    historyForAgent(req, res) {
      const id = parseId(req.params.id);
      if (!agents.get(id)) throw notFound();
      res.json({ success: true, data: executions.forAgent(id) });
    },
  };
}

module.exports = { createAgentController, parseId };
