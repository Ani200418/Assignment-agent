// Service-layer tests against a REAL SQLite database (in memory, or a temp file for restart tests).
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../src/db/database');
const { createAgentService } = require('../src/services/agentService');
const { createExecutionService } = require('../src/services/executionService');
const fs = require('node:fs');
const path = require('node:path');
const { tempDb, validAgent, sleep, MODULES } = require('./helpers');

let db, agents, executions;
beforeEach(() => {
  db = createDatabase(':memory:');
  agents = createAgentService(db);
  executions = createExecutionService(db, agents);
});
afterEach(() => db.close());

const count = (table) => db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
const publishedAgent = (module = 'Task') => agents.publish(agents.create(validAgent(module)).id);
const rejectsWith = (fn, status, code) =>
  assert.throws(fn, (e) => { assert.equal(e.status, status); assert.equal(e.code, code); return true; });

describe('creating and listing agents', () => {
  for (const module of MODULES) {
    test(`${module}: create saves a draft with ISO timestamps and persists it`, () => {
      const a = agents.create(validAgent(module));
      assert.equal(a.status, 'draft');
      assert.equal(a.module, module);
      assert.equal(a.published_at, null);
      assert.ok(!Number.isNaN(Date.parse(a.created_at)), 'created_at is a valid date');
      assert.match(a.created_at, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
      assert.deepEqual(agents.get(a.id).config, a.config);
      assert.equal(count('agents'), 1);
    });
  }

  test('invalid input is rejected with 400 and nothing is stored', () => {
    rejectsWith(() => agents.create({}), 400, 'VALIDATION_ERROR');
    rejectsWith(() => agents.create(validAgent('Task', { module: 'Nope' })), 400, 'VALIDATION_ERROR');
    rejectsWith(() => agents.create(validAgent('DSC', { config: { trigger: 'Task created' } })), 400, 'VALIDATION_ERROR');
    assert.equal(count('agents'), 0);
  });

  test('a client-supplied status is ignored: new agents are always drafts', () => {
    assert.equal(agents.create(validAgent('Task', { status: 'published' })).status, 'draft');
  });

  test('list returns the real database rows, with module/status/search filters', () => {
    agents.create(validAgent('Task', { name: 'Alpha task' }));
    agents.create(validAgent('DSC', { name: 'Beta dsc' }));
    const lic = agents.create(validAgent('License', { name: 'Gamma license' }));
    agents.publish(lic.id);

    assert.equal(agents.list().length, 3);
    assert.deepEqual(agents.list({ module: 'DSC' }).map((a) => a.name), ['Beta dsc']);
    assert.deepEqual(agents.list({ status: 'published' }).map((a) => a.name), ['Gamma license']);
    assert.deepEqual(agents.list({ search: 'ALPHA' }).map((a) => a.name), ['Alpha task']);
    assert.deepEqual(agents.list({ search: 'nothing-matches' }), []);
    assert.equal(agents.list({ module: 'Task', status: 'published' }).length, 0);
  });

  test('search treats % and _ as literal characters, not wildcards', () => {
    agents.create(validAgent('Task', { name: 'Plain name' }));
    agents.create(validAgent('Task', { name: '100% done' }));
    assert.deepEqual(agents.list({ search: '%' }).map((a) => a.name), ['100% done']);
    assert.deepEqual(agents.list({ search: '_' }), []);
  });

  test('invalid module/status filters are rejected with 400', () => {
    rejectsWith(() => agents.list({ module: 'Nope' }), 400, 'INVALID_FILTER');
    rejectsWith(() => agents.list({ status: 'archived' }), 400, 'INVALID_FILTER');
  });

  test('list is ordered by most recently updated first', async () => {
    const a = agents.create(validAgent('Task', { name: 'first' }));
    await sleep(5);
    const b = agents.create(validAgent('Task', { name: 'second' }));
    assert.deepEqual(agents.list().map((x) => x.id), [b.id, a.id]);
    await sleep(5);
    agents.update(a.id, { name: 'first (edited)' });
    assert.deepEqual(agents.list().map((x) => x.id), [a.id, b.id]);
  });

  test('get returns null for a missing id', () => {
    assert.equal(agents.get(9999), null);
  });

  test('one damaged config_json row does not break the list', () => {
    const a = agents.create(validAgent('Task'));
    agents.create(validAgent('DSC'));
    db.prepare('UPDATE agents SET config_json = ? WHERE id = ?').run('{not json', a.id);
    assert.equal(agents.list().length, 2);
    assert.deepEqual(agents.get(a.id).config, {});
  });
});

describe('editing a draft and Save Draft', () => {
  test('update persists changes, keeps draft status and advances updated_at only', async () => {
    const a = agents.create(validAgent('Task'));
    await sleep(5);
    const b = agents.update(a.id, { name: 'Renamed', config: validAgent('Task', { config: { channel: 'WhatsApp', message: 'New text' } }).config });
    assert.equal(b.name, 'Renamed');
    assert.equal(b.status, 'draft');
    assert.equal(b.config.channel, 'WhatsApp');
    assert.equal(b.created_at, a.created_at);
    assert.ok(b.updated_at > a.updated_at, 'updated_at moved forward');
    const row = db.prepare('SELECT name, config_json FROM agents WHERE id = ?').get(a.id);
    assert.equal(row.name, 'Renamed');
    assert.equal(JSON.parse(row.config_json).message, 'New text');
  });

  test('a partial update (name only) keeps the existing config', () => {
    const a = agents.create(validAgent('DSC'));
    const b = agents.update(a.id, { name: 'Only the name' });
    assert.deepEqual(b.config, a.config);
  });

  test('an invalid update is rejected and the stored agent is unchanged', () => {
    const a = agents.create(validAgent('Task'));
    rejectsWith(() => agents.update(a.id, { name: '   ' }), 400, 'VALIDATION_ERROR');
    rejectsWith(() => agents.update(a.id, { config: { trigger: 'Nope' } }), 400, 'VALIDATION_ERROR');
    rejectsWith(() => agents.update(a.id, [1, 2]), 400, 'VALIDATION_ERROR');
    assert.equal(agents.get(a.id).name, a.name);
  });

  test('changing the module without a matching trigger is rejected', () => {
    const a = agents.create(validAgent('Task'));
    rejectsWith(() => agents.update(a.id, { module: 'DSC' }), 400, 'VALIDATION_ERROR');
  });

  test('changing the module together with a matching config works', () => {
    const a = agents.create(validAgent('Task'));
    const b = agents.update(a.id, validAgent('License'));
    assert.equal(b.module, 'License');
  });

  test('updating a missing agent returns null', () => {
    assert.equal(agents.update(9999, { name: 'x' }), null);
  });

  test('a published agent cannot be edited (409)', () => {
    const a = publishedAgent();
    rejectsWith(() => agents.update(a.id, { name: 'Sneaky' }), 409, 'INVALID_STATE');
    assert.equal(agents.get(a.id).name, a.name);
  });
});

describe('draft vs published vs disabled', () => {
  test('publish changes status and sets published_at / updated_at', async () => {
    const a = agents.create(validAgent('Task'));
    await sleep(5);
    const p = agents.publish(a.id);
    assert.equal(p.status, 'published');
    assert.ok(p.published_at, 'published_at is set');
    assert.ok(p.updated_at > a.updated_at);
    assert.equal(p.created_at, a.created_at);
  });

  test('publishing twice, or publishing a disabled agent, is a 409', () => {
    const a = publishedAgent();
    rejectsWith(() => agents.publish(a.id), 409, 'INVALID_STATE');
    agents.disable(a.id);
    rejectsWith(() => agents.publish(a.id), 409, 'INVALID_STATE');
  });

  test('publish of a missing agent returns null', () => {
    assert.equal(agents.publish(9999), null);
  });

  test('an agent whose stored config is invalid cannot be published', () => {
    const a = agents.create(validAgent('Task'));
    db.prepare('UPDATE agents SET config_json = ? WHERE id = ?').run(JSON.stringify({ trigger: 'DSC expired' }), a.id);
    rejectsWith(() => agents.publish(a.id), 400, 'VALIDATION_ERROR');
    assert.equal(agents.get(a.id).status, 'draft');
  });

  test('disable works only on published agents', () => {
    const draft = agents.create(validAgent('Task'));
    rejectsWith(() => agents.disable(draft.id), 409, 'INVALID_STATE');
    const pub = agents.publish(draft.id);
    const d = agents.disable(pub.id);
    assert.equal(d.status, 'disabled');
    rejectsWith(() => agents.disable(pub.id), 409, 'INVALID_STATE');
    assert.equal(agents.disable(9999), null);
  });

  test('a disabled agent cannot be edited', () => {
    const a = publishedAgent();
    agents.disable(a.id);
    rejectsWith(() => agents.update(a.id, { name: 'x' }), 409, 'INVALID_STATE');
  });
});

describe('simulated test runs', () => {
  for (const module of MODULES) {
    test(`${module}: a test run succeeds, is labelled simulated, and is stored in agent_runs`, () => {
      const agent = publishedAgent(module);
      const run = executions.run(agent.id);
      assert.equal(run.status, 'success');
      assert.equal(run.run_type, 'test');
      assert.equal(run.error_message, null);
      assert.equal(run.result.simulated, true);
      assert.match(run.result.message, /No real notification was sent/);
      assert.equal(run.trigger_data.simulated, true);
      assert.equal(run.trigger_data.event, agent.config.trigger);
      assert.equal(run.result.channel, 'Email');
      assert.equal(count('agent_runs'), 1);
      const row = db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(run.id);
      assert.equal(row.agent_id, agent.id);
      assert.equal(row.status, 'success');
    });
  }

  test('the sample event matches the module (Task / DSC / License)', () => {
    assert.ok(executions.run(publishedAgent('Task').id).trigger_data.task);
    assert.ok(executions.run(publishedAgent('DSC').id).trigger_data.dsc);
    assert.ok(executions.run(publishedAgent('License').id).trigger_data.license);
  });

  test('the configured condition is reflected in the simulated event', () => {
    const a = agents.publish(agents.create(validAgent('DSC', { config: { conditions: { daysBeforeExpiry: 7 } } })).id);
    const run = executions.run(a.id);
    assert.equal(run.trigger_data.daysToExpiry, 7);
    assert.deepEqual(run.result.conditions, { daysBeforeExpiry: 7 });
  });

  test('deterministic: the same config produces the same event and result every time', () => {
    const a = publishedAgent('License');
    const r1 = executions.run(a.id);
    const r2 = executions.run(a.id);
    assert.deepEqual(r1.trigger_data, r2.trigger_data);
    assert.deepEqual(r1.result, r2.result);
    assert.notEqual(r1.id, r2.id);
  });

  test('draft and disabled agents cannot be test-run (409) and no run is recorded', () => {
    const draft = agents.create(validAgent('Task'));
    rejectsWith(() => executions.run(draft.id), 409, 'INVALID_STATE');
    const pub = agents.publish(draft.id);
    agents.disable(pub.id);
    rejectsWith(() => executions.run(pub.id), 409, 'INVALID_STATE');
    assert.equal(count('agent_runs'), 0);
  });

  test('a missing agent returns null and records nothing', () => {
    assert.equal(executions.run(9999), null);
    assert.equal(count('agent_runs'), 0);
  });

  test('FAILURE: an invalid stored config produces a stored FAILED run with an error message', () => {
    const a = publishedAgent('Task');
    // Simulate corruption/manual editing: the trigger now belongs to another module.
    db.prepare('UPDATE agents SET config_json = ? WHERE id = ?').run(JSON.stringify({ ...a.config, trigger: 'DSC expired' }), a.id);
    const run = executions.run(a.id);
    assert.equal(run.status, 'failed');
    assert.match(run.error_message, /Simulation failed/);
    assert.match(run.error_message, /not available for the Task module/);
    assert.equal(run.result, null);
    assert.equal(count('agent_runs'), 1);
  });

  test('FAILURE: a damaged config_json is a failed run, not a server crash', () => {
    const a = publishedAgent('DSC');
    db.prepare('UPDATE agents SET config_json = ? WHERE id = ?').run('{broken', a.id);
    const run = executions.run(a.id);
    assert.equal(run.status, 'failed');
    assert.match(run.error_message, /Configuration is required|Trigger is required/);
  });

  test('FAILURE: a failed run is visible in history like any other run', () => {
    const a = publishedAgent('Task');
    db.prepare('UPDATE agents SET config_json = ? WHERE id = ?').run(JSON.stringify({}), a.id);
    executions.run(a.id);
    const [latest] = executions.list();
    assert.equal(latest.status, 'failed');
    assert.equal(latest.agent_name, a.name);
  });
});

describe('execution history and timestamps', () => {
  test('history is newest first and every run has a valid, recent ISO timestamp', async () => {
    const a = publishedAgent('Task');
    const before = Date.now() - 1000;
    const r1 = executions.run(a.id);
    await sleep(5);
    const r2 = executions.run(a.id);
    const history = executions.forAgent(a.id);
    assert.deepEqual(history.map((r) => r.id), [r2.id, r1.id]);
    for (const r of history) {
      const t = Date.parse(r.created_at);
      assert.ok(t >= before && t <= Date.now() + 1000, 'timestamp is current');
    }
    assert.ok(history[0].created_at >= history[1].created_at);
  });

  test('runs with identical timestamps still come back newest-first (the query adds an id tiebreak; SQLite happens to agree even without it)', () => {
    const a = publishedAgent('Task');
    const ins = db.prepare("INSERT INTO agent_runs (agent_id, status, created_at) VALUES (?, 'success', '2026-01-01T00:00:00.000Z')");
    const id1 = ins.run(a.id).lastInsertRowid;
    const id2 = ins.run(a.id).lastInsertRowid;
    assert.deepEqual(executions.forAgent(a.id).map((r) => r.id), [Number(id2), Number(id1)]);
  });

  test('global history joins agent name/module and respects the limit', () => {
    const t = publishedAgent('Task');
    const d = publishedAgent('DSC');
    executions.run(t.id);
    executions.run(d.id);
    executions.run(d.id);
    const all = executions.list();
    assert.equal(all.length, 3);
    assert.equal(all[0].agent_module, 'DSC');
    assert.equal(all[0].agent_name, d.name);
    assert.equal(executions.list(2).length, 2);
    assert.equal(executions.list('abc').length, 3, 'a non-numeric limit falls back to the default');
  });

  test("an agent's history contains only that agent's runs", () => {
    const t = publishedAgent('Task');
    const l = publishedAgent('License');
    executions.run(t.id);
    executions.run(l.id);
    assert.equal(executions.forAgent(t.id).length, 1);
    assert.equal(executions.forAgent(t.id)[0].agent_id, t.id);
  });

  test('history is empty for a new agent and for an empty database', () => {
    assert.deepEqual(executions.list(), []);
    assert.deepEqual(executions.forAgent(agents.create(validAgent('Task')).id), []);
  });
});

describe('database integrity and persistence', () => {
  test('the database itself refuses an invalid module/status and orphan runs', () => {
    assert.throws(() => db.prepare("INSERT INTO agents (name, module, config_json) VALUES ('x', 'Nope', '{}')").run());
    assert.throws(() => db.prepare("INSERT INTO agents (name, module, status, config_json) VALUES ('x', 'Task', 'archived', '{}')").run());
    assert.throws(() => db.prepare("INSERT INTO agent_runs (agent_id, status) VALUES (999, 'success')").run(), /FOREIGN KEY/);
  });

  test('data survives a backend restart (close and reopen the database file)', () => {
    const tmp = tempDb();
    try {
      let d1 = createDatabase(tmp.file);
      const a1 = createAgentService(d1);
      const e1 = createExecutionService(d1, a1);
      const agent = a1.publish(a1.create(validAgent('DSC', { name: 'Persisted DSC agent' })).id);
      const draft = a1.create(validAgent('Task', { name: 'Persisted draft' }));
      const run = e1.run(agent.id);
      d1.close(); // "stop the backend"

      const d2 = createDatabase(tmp.file); // "start the backend again" (schema init runs again, must not wipe data)
      const a2 = createAgentService(d2);
      const e2 = createExecutionService(d2, a2);
      assert.equal(a2.list().length, 2);
      assert.equal(a2.get(agent.id).status, 'published');
      assert.equal(a2.get(agent.id).name, 'Persisted DSC agent');
      assert.equal(a2.get(draft.id).status, 'draft');
      const history = e2.forAgent(agent.id);
      assert.equal(history.length, 1);
      assert.equal(history[0].id, run.id);
      assert.equal(history[0].created_at, run.created_at);
      d2.close();
    } finally {
      tmp.cleanup();
    }
  });
});

describe('fresh database initialisation', () => {
  test('a brand-new file in a folder that does not exist yet is created with the full schema', () => {
    const tmp = tempDb();
    try {
      const file = path.join(tmp.dir, 'nested', 'deeper', 'fresh.db'); // neither folder exists yet
      assert.equal(fs.existsSync(path.dirname(file)), false);
      const fresh = createDatabase(file);
      assert.equal(fs.existsSync(file), true, 'database file was created');
      const names = (type) => fresh.prepare('SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE ?').all(type, 'sqlite_%').map((r) => r.name).sort();
      assert.deepEqual(names('table'), ['agent_runs', 'agents']);
      assert.deepEqual(names('index'), ['idx_agents_module_status', 'idx_agents_updated_at', 'idx_runs_agent_created', 'idx_runs_created']);
      assert.equal(fresh.prepare('SELECT COUNT(*) AS c FROM agents').get().c, 0, 'starts empty (no hidden seed data)');
      assert.equal(fresh.prepare('SELECT COUNT(*) AS c FROM agent_runs').get().c, 0);
      // and it is immediately usable end to end
      const a = createAgentService(fresh);
      const e = createExecutionService(fresh, a);
      const agent = a.publish(a.create(validAgent('License')).id);
      assert.equal(e.run(agent.id).status, 'success');
      fresh.close();
    } finally { tmp.cleanup(); }
  });

  test('initialising an in-memory database twice in a row is harmless and independent', () => {
    const one = createDatabase(':memory:');
    const two = createDatabase(':memory:');
    createAgentService(one).create(validAgent('Task'));
    assert.equal(two.prepare('SELECT COUNT(*) AS c FROM agents').get().c, 0);
    one.close(); two.close();
  });

  test('foreign keys are enforced on every new connection', () => {
    const fresh = createDatabase(':memory:');
    assert.throws(() => fresh.prepare("INSERT INTO agent_runs (agent_id, status) VALUES (42, 'success')").run(), /FOREIGN KEY/);
    fresh.close();
  });

  test('deleting an agent removes its runs (ON DELETE CASCADE)', () => {
    const agent = publishedAgent('Task');
    executions.run(agent.id); executions.run(agent.id);
    assert.equal(count('agent_runs'), 2);
    db.prepare('DELETE FROM agents WHERE id = ?').run(agent.id);
    assert.equal(count('agent_runs'), 0);
  });
});
