// Tests the REAL controllers + error handler (status codes and JSON shapes) by calling them
// with fake request/response objects. This does not need Express, so it runs anywhere.
// HTTP routing / JSON parsing / CORS are covered separately in api.test.js.
const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../src/db/database');
const { createAgentController } = require('../src/controllers/agentController');
const { errorHandler } = require('../src/middleware/errorHandler');
const { validAgent, MODULES } = require('./helpers');

let db, c;
beforeEach(() => { db = createDatabase(':memory:'); c = createAgentController(db); });
afterEach(() => { try { db.close(); } catch { /* already closed by a test */ } });

// Call a handler the way Express would: a thrown error goes to errorHandler.
function call(handler, { params = {}, query = {}, body = {} } = {}) {
  let out;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { out = { status: this.statusCode, body: payload }; return this; },
  };
  try { handler({ params, query, body }, res); } catch (err) { errorHandler(err, {}, res, () => {}); }
  return out;
}

const create = (module = 'Task') => call(c.create, { body: validAgent(module) }).body.data;
const publish = (id) => call(c.publish, { params: { id: String(id) } });

describe('create / get / list', () => {
  test('list on an empty database returns an empty array', () => {
    const r = call(c.list);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { success: true, data: [] });
  });

  for (const module of MODULES) {
    test(`${module}: POST creates a draft (201) that GET and list return`, () => {
      const r = call(c.create, { body: validAgent(module) });
      assert.equal(r.status, 201);
      assert.equal(r.body.success, true);
      assert.equal(r.body.data.status, 'draft');
      assert.equal(call(c.get, { params: { id: String(r.body.data.id) } }).body.data.name, `${module} test agent`);
      assert.equal(call(c.list, { query: { module } }).body.data.length, 1);
    });
  }

  test('invalid create returns 400 VALIDATION_ERROR with readable details', () => {
    const r = call(c.create, { body: {} });
    assert.equal(r.status, 400);
    assert.equal(r.body.success, false);
    assert.equal(r.body.error.code, 'VALIDATION_ERROR');
    assert.match(r.body.error.message, /Name is required/);
    assert.ok(Array.isArray(r.body.error.details) && r.body.error.details.length > 1);
  });

  test('a body that is not an object returns 400', () => {
    assert.equal(call(c.create, { body: [] }).status, 400);
    assert.equal(call(c.create, { body: undefined }).status, 400);
  });

  test('list filters are validated and reflected', () => {
    create('Task'); create('DSC');
    assert.equal(call(c.list, { query: { module: 'Nope' } }).status, 400);
    assert.equal(call(c.list, { query: { status: 'archived' } }).status, 400);
    assert.equal(call(c.list, { query: { status: 'published' } }).body.data.length, 0);
    assert.equal(call(c.list, { query: { search: ['a', 'b'] } }).status, 200, 'a repeated query param does not crash');
  });
});

describe('missing records and invalid ids', () => {
  const routes = { get: c => c.get, update: c => c.update, publish: c => c.publish, disable: c => c.disable, testRun: c => c.testRun, historyForAgent: c => c.historyForAgent };

  for (const [name, pick] of Object.entries(routes)) {
    test(`${name}: a missing agent returns 404 NOT_FOUND`, () => {
      const r = call(pick(c), { params: { id: '9999' }, body: { name: 'x' } });
      assert.equal(r.status, 404);
      assert.equal(r.body.error.code, 'NOT_FOUND');
    });

    for (const bad of ['abc', '0', '-1', '1.5', '1e2', '0x10', ' ', '']) {
      test(`${name}: id ${JSON.stringify(bad)} returns 400 INVALID_ID`, () => {
        const r = call(pick(c), { params: { id: bad }, body: {} });
        assert.equal(r.status, 400);
        assert.equal(r.body.error.code, 'INVALID_ID');
      });
    }
  }
});

describe('edit / publish / disable / test-run over the API layer', () => {
  test('PUT edits a draft (200) and it stays a draft', () => {
    const a = create('Task');
    const r = call(c.update, { params: { id: String(a.id) }, body: { name: 'Edited' } });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.name, 'Edited');
    assert.equal(r.body.data.status, 'draft');
  });

  test('PUT with invalid data returns 400 and leaves the agent unchanged', () => {
    const a = create('Task');
    const r = call(c.update, { params: { id: String(a.id) }, body: { name: '' , config: { trigger: 'Nope' } } });
    assert.equal(r.status, 400);
    assert.equal(call(c.get, { params: { id: String(a.id) } }).body.data.name, a.name);
  });

  test('full lifecycle: publish 200 -> edit 409 -> test-run 201 -> disable 200 -> test-run 409', () => {
    const a = create('License');
    const id = { params: { id: String(a.id) } };
    assert.equal(call(c.testRun, id).status, 409, 'cannot test-run a draft');
    const p = publish(a.id);
    assert.equal(p.status, 200);
    assert.equal(p.body.data.status, 'published');
    assert.equal(publish(a.id).status, 409, 'cannot publish twice');
    const edit = call(c.update, { ...id, body: { name: 'x' } });
    assert.equal(edit.status, 409);
    assert.equal(edit.body.error.code, 'INVALID_STATE');
    const run = call(c.testRun, id);
    assert.equal(run.status, 201);
    assert.equal(run.body.data.status, 'success');
    assert.equal(run.body.data.result.simulated, true);
    const d = call(c.disable, id);
    assert.equal(d.status, 200);
    assert.equal(d.body.data.status, 'disabled');
    assert.equal(call(c.disable, id).status, 409);
    assert.equal(call(c.testRun, id).status, 409, 'a disabled agent cannot be executed');
  });

  test('a failed simulation is returned as 201 with data.status "failed" and is in agent history', () => {
    const a = create('Task');
    publish(a.id);
    db.prepare('UPDATE agents SET config_json = ? WHERE id = ?').run(JSON.stringify({ trigger: 'DSC expired' }), a.id);
    const r = call(c.testRun, { params: { id: String(a.id) } });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.status, 'failed');
    assert.match(r.body.data.error_message, /Simulation failed/);
    const h = call(c.historyForAgent, { params: { id: String(a.id) } });
    assert.equal(h.body.data.length, 1);
    assert.equal(h.body.data[0].status, 'failed');
  });

  test('history for an agent with no runs is an empty array (200)', () => {
    const a = create('DSC');
    const h = call(c.historyForAgent, { params: { id: String(a.id) } });
    assert.equal(h.status, 200);
    assert.deepEqual(h.body.data, []);
  });
});

describe('unexpected errors', () => {
  test('a database failure becomes a generic 500 and does not leak internals', () => {
    const quiet = mock.method(console, 'error', () => {});
    db.close(); // simulate the database going away
    const r = call(c.list);
    quiet.mock.restore();
    assert.equal(r.status, 500);
    assert.equal(r.body.error.code, 'INTERNAL_ERROR');
    assert.doesNotMatch(JSON.stringify(r.body), /sqlite|database connection|stack/i);
  });
});
