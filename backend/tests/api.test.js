// End-to-end HTTP tests: real Express app + real SQLite file, called with fetch().
// Uses a temporary database; the demo database is never touched.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');
const { tempDb, validAgent, MODULES } = require('./helpers');

async function startServer(dbFile, corsOrigins = ['http://localhost:3000']) {
  const db = createDatabase(dbFile);
  const app = createApp({ db, corsOrigins });
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    db, base,
    async stop() {
      await new Promise((resolve) => { server.close(resolve); server.closeAllConnections?.(); });
      db.close();
    },
  };
}

async function req(base, method, path, body) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(base + path, options);
  return { status: res.status, body: await res.json(), headers: res.headers };
}

const tmp = tempDb();
let srv;
before(async () => { srv = await startServer(tmp.file); });
after(async () => { await srv.stop(); tmp.cleanup(); });

describe('infrastructure', () => {
  test('GET /api/health reports the database is connected', async () => {
    const r = await req(srv.base, 'GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.data.status, 'ok');
    assert.equal(r.body.data.database, 'connected');
  });

  test('GET /api/agents returns the current agent list', async () => {
    const r = await req(srv.base, 'GET', '/api/agents');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { success: true, data: [] });
  });

  test('unknown routes return a JSON 404', async () => {
    const r = await req(srv.base, 'GET', '/api/nope');
    assert.equal(r.status, 404);
    assert.equal(r.body.success, false);
    assert.equal(r.body.error.code, 'NOT_FOUND');
  });

  test('malformed JSON returns 400 INVALID_JSON (not a crash)', async () => {
    const r = await req(srv.base, 'POST', '/api/agents', '{"name": ');
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'INVALID_JSON');
  });

  test('an oversized body returns 413', async () => {
    const r = await req(srv.base, 'POST', '/api/agents', { name: 'x'.repeat(200 * 1024) });
    assert.equal(r.status, 413);
  });

  test('GET /api/agent-definitions exposes the three modules, their triggers and options', async () => {
    const r = await req(srv.base, 'GET', '/api/agent-definitions');
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body.data.modules).sort(), ['DSC', 'License', 'Task']);
    assert.ok(r.body.data.modules.Task.triggers.some((t) => t.value === 'Task due soon' && t.condition.key === 'daysBeforeDue'));
    assert.ok(r.body.data.channels.includes('Email'));
  });

  test('CORS allows the configured frontend origin and not others', async () => {
    const headersFor = (origin) => new Promise((resolve, reject) => {
      const url = new URL('/api/health', srv.base);
      http.get({ hostname: url.hostname, port: url.port, path: url.pathname, headers: { Origin: origin } }, (res) => { res.resume(); resolve(res.headers); }).on('error', reject);
    });
    assert.equal((await headersFor('http://localhost:3000'))['access-control-allow-origin'], 'http://localhost:3000');
    assert.equal((await headersFor('http://evil.example'))['access-control-allow-origin'], undefined);
  });

  test('the X-Powered-By header is not advertised', async () => {
    const r = await req(srv.base, 'GET', '/api/health');
    assert.equal(r.headers.get('x-powered-by'), null);
  });
});

describe('complete workflow for each module', () => {
  for (const module of MODULES) {
    test(`${module}: create -> list -> edit -> publish -> test-run -> history -> disable`, async () => {
      const created = await req(srv.base, 'POST', '/api/agents', validAgent(module));
      assert.equal(created.status, 201);
      const id = created.body.data.id;
      assert.equal(created.body.data.status, 'draft');

      const listed = await req(srv.base, 'GET', `/api/agents?module=${module}`);
      assert.ok(listed.body.data.some((a) => a.id === id));

      const edited = await req(srv.base, 'PUT', `/api/agents/${id}`, { name: `${module} edited` });
      assert.equal(edited.status, 200);
      assert.equal(edited.body.data.name, `${module} edited`);
      assert.equal(edited.body.data.status, 'draft');

      const pub = await req(srv.base, 'POST', `/api/agents/${id}/publish`, {});
      assert.equal(pub.status, 200);
      assert.equal(pub.body.data.status, 'published');
      assert.ok(pub.body.data.published_at);

      const run = await req(srv.base, 'POST', `/api/agents/${id}/test-run`, {});
      assert.equal(run.status, 201);
      assert.equal(run.body.data.status, 'success');
      assert.equal(run.body.data.result.simulated, true);

      const agentHistory = await req(srv.base, 'GET', `/api/agents/${id}/history`);
      assert.equal(agentHistory.body.data[0].id, run.body.data.id);
      const globalHistory = await req(srv.base, 'GET', '/api/history');
      assert.ok(globalHistory.body.data.some((r) => r.id === run.body.data.id && r.agent_module === module));

      const dis = await req(srv.base, 'POST', `/api/agents/${id}/disable`, {});
      assert.equal(dis.body.data.status, 'disabled');
      const afterDisable = await req(srv.base, 'POST', `/api/agents/${id}/test-run`, {});
      assert.equal(afterDisable.status, 409);
      assert.equal(afterDisable.body.error.code, 'INVALID_STATE');
    });
  }
});

describe('validation and errors over HTTP', () => {
  test('empty form -> 400 with a readable message', async () => {
    const r = await req(srv.base, 'POST', '/api/agents', {});
    assert.equal(r.status, 400);
    assert.match(r.body.error.message, /Name is required/);
  });

  test('wrong module/trigger pair -> 400', async () => {
    const r = await req(srv.base, 'POST', '/api/agents', validAgent('Task', { config: { trigger: 'License expired' } }));
    assert.equal(r.status, 400);
  });

  test('missing agent -> 404 on every route; bad id -> 400', async () => {
    for (const [method, path] of [['GET', '/api/agents/99999'], ['PUT', '/api/agents/99999'], ['POST', '/api/agents/99999/publish'], ['POST', '/api/agents/99999/disable'], ['POST', '/api/agents/99999/test-run'], ['GET', '/api/agents/99999/history']]) {
      const r = await req(srv.base, method, path, {});
      assert.equal(r.status, 404, `${method} ${path}`);
    }
    for (const id of ['abc', '1.5', '0', '-1']) {
      assert.equal((await req(srv.base, 'GET', `/api/agents/${id}`)).status, 400, `id ${id}`);
    }
  });

  test('invalid filter -> 400', async () => {
    assert.equal((await req(srv.base, 'GET', '/api/agents?module=Nope')).status, 400);
  });
});

describe('persistence across a backend restart', () => {
  test('agents and history are still there after the server is stopped and started again', async () => {
    const t = tempDb();
    try {
      let s = await startServer(t.file);
      const a = (await req(s.base, 'POST', '/api/agents', validAgent('DSC', { name: 'Survivor' }))).body.data;
      await req(s.base, 'POST', `/api/agents/${a.id}/publish`, {});
      const run = (await req(s.base, 'POST', `/api/agents/${a.id}/test-run`, {})).body.data;
      await s.stop();

      s = await startServer(t.file); // brand-new server + database connection, same file
      const again = await req(s.base, 'GET', `/api/agents/${a.id}`);
      assert.equal(again.body.data.name, 'Survivor');
      assert.equal(again.body.data.status, 'published');
      const history = await req(s.base, 'GET', `/api/agents/${a.id}/history`);
      assert.equal(history.body.data[0].id, run.id);
      await s.stop();
    } finally {
      t.cleanup();
    }
  });
});
