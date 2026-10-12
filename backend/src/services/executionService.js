// SIMULATED execution. Nothing here sends email/WhatsApp or talks to a scheduler.
//
// Meaning of the result:
//   status 'success' = the agent's configuration passed validation AND the simulated run completed.
//   status 'failed'  = the configuration was not valid at run time (e.g. edited in the database, or damaged).
// Either way a row is written to agent_runs, so the History page always shows what happened.
const { validateConfig } = require('../validators/agentValidator');
const { findTrigger } = require('../config/agentDefinitions');
const { HttpError } = require('../middleware/errorHandler');

function safeParse(json) {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function createExecutionService(db, agentService) {
  const insert = db.prepare(
    `INSERT INTO agent_runs (agent_id, run_type, status, trigger_data_json, result_json, error_message, created_at)
     VALUES (?, 'test', ?, ?, ?, ?, ?)`
  );
  const getRun = db.prepare('SELECT * FROM agent_runs WHERE id = ?');
  const getRuns = db.prepare('SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY created_at DESC, id DESC');
  const getAllRuns = db.prepare(
    `SELECT r.*, a.name AS agent_name, a.module AS agent_module,
            'run' AS history_type, 'test-run' AS action
       FROM agent_runs r JOIN agents a ON a.id = r.agent_id
      ORDER BY r.created_at DESC, r.id DESC LIMIT ?`
  );
  const getAllWithCreations = db.prepare(
    `SELECT * FROM (
       SELECT r.*, a.name AS agent_name, a.module AS agent_module,
              'run' AS history_type, 'test-run' AS action
         FROM agent_runs r JOIN agents a ON a.id = r.agent_id
       UNION ALL
       SELECT a.id, a.id AS agent_id, NULL AS run_type, 'draft' AS status,
              NULL AS trigger_data_json, NULL AS result_json, NULL AS error_message,
              a.created_at, a.name AS agent_name, a.module AS agent_module,
              'activity' AS history_type, 'created' AS action
         FROM agents a
     ) history
     ORDER BY created_at DESC, id DESC LIMIT ?`
  );

  function map(row) {
    if (!row) return null;
    return { ...row, trigger_data: safeParse(row.trigger_data_json), result: safeParse(row.result_json) };
  }

  return {
    // Returns null if the agent does not exist; throws 409 if it is not published.
    run(id) {
      const agent = agentService.get(id);
      if (!agent) return null;
      if (agent.status !== 'published') {
        throw new HttpError(409, 'INVALID_STATE', `Only published agents can be test-run (this agent is ${agent.status}).`);
      }

      const now = new Date().toISOString();
      const check = validateConfig(agent.module, agent.config);

      if (!check.valid) {
        const triggerData = { simulated: true, event: typeof agent.config?.trigger === 'string' ? agent.config.trigger : null };
        const error = `Simulation failed: ${check.errors.join(' ')}`;
        const info = insert.run(id, 'failed', JSON.stringify(triggerData), null, error, now);
        return map(getRun.get(info.lastInsertRowid));
      }

      const cfg = check.config;
      const trigger = findTrigger(agent.module, cfg.trigger);
      const triggerData = { simulated: true, ...trigger.sampleEvent(cfg.conditions) }; // same config => same event
      const result = {
        simulated: true,
        label: 'SIMULATED RUN: no notification was sent.',
        message: `Simulation completed for “${agent.name}”. No real notification was sent.`,
        trigger: cfg.trigger,
        conditions: cfg.conditions,
        recipient: cfg.recipient,
        channel: cfg.channel,
        action: cfg.action,
        renderedMessage: cfg.message,
        steps: [
          `Sample "${cfg.trigger}" event generated.`,
          'Conditions evaluated against the sample event.',
          `Recipient resolved (simulated): ${cfg.recipient}.`,
          `Would deliver via ${cfg.channel} (not sent).`,
          `Action prepared: ${cfg.action}.`,
        ],
      };
      const info = insert.run(id, 'success', JSON.stringify(triggerData), JSON.stringify(result), null, now);
      return map(getRun.get(info.lastInsertRowid));
    },

    forAgent(id) {
      return getRuns.all(id).map(map);
    },

    list(limit = 100, includeActivities = false) {
      const size = Math.min(Math.max(Number(limit) || 100, 1), 250);
      return (includeActivities ? getAllWithCreations : getAllRuns).all(size).map(map);
    },
  };
}

module.exports = { createExecutionService };
