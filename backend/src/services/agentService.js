// Business rules for agents + all agent SQL. Controllers never touch SQL.
//
// State rules (documented in README):
//   draft     --publish--> published     (draft can also be edited)
//   published --disable--> disabled
//   disabled  = terminal in this MVP (cannot be edited, published, or test-run)
const { validateAgent, validateDraftAgent, MODULES, STATUSES } = require('../validators/agentValidator');
const { HttpError } = require('../middleware/errorHandler');

function parseConfig(json) {
  try {
    const value = JSON.parse(json);
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {}; // a damaged row must not break the whole list; the simulator reports it as a failed run
  }
}

function rowToAgent(row) {
  if (!row) return null;
  const { config_json, ...rest } = row;
  return { ...rest, config: parseConfig(config_json) };
}

function validationError(prefix, errors) {
  return new HttpError(400, 'VALIDATION_ERROR', `${prefix}${errors.join(' ')}`, errors);
}

function createAgentService(db) {
  const getRow = db.prepare('SELECT * FROM agents WHERE id = ?');
  const listStmt = db.prepare(
    `SELECT * FROM agents
      WHERE (? IS NULL OR module = ?) AND (? IS NULL OR status = ?) AND (? = '' OR lower(name) LIKE lower(?) ESCAPE '\\')
      ORDER BY updated_at DESC, id DESC`
  );
  const insertStmt = db.prepare(
    'INSERT INTO agents (name, module, description, status, config_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const updateStmt = db.prepare('UPDATE agents SET name = ?, module = ?, description = ?, config_json = ?, updated_at = ? WHERE id = ?');
  const publishStmt = db.prepare("UPDATE agents SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?");
  const disableStmt = db.prepare("UPDATE agents SET status = 'disabled', updated_at = ? WHERE id = ?");

  const asAgentInput = (agent) => ({ name: agent.name, module: agent.module, description: agent.description, config: agent.config });

  return {
    list({ module = null, status = null, search = '' } = {}) {
      if (module && !MODULES.includes(module)) throw new HttpError(400, 'INVALID_FILTER', 'Invalid module filter.');
      if (status && !STATUSES.includes(status)) throw new HttpError(400, 'INVALID_FILTER', 'Invalid status filter.');
      const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`; // user-typed % and _ are literal characters
      return listStmt.all(module || null, module || null, status || null, status || null, search, like).map(rowToAgent);
    },

    get(id) {
      return rowToAgent(getRow.get(id));
    },

    create(input) {
      const v = input?.saveDraft ? validateDraftAgent(input) : validateAgent(input);
      if (!v.valid) throw validationError('', v.errors);
      const now = new Date().toISOString();
      const { name, module, description, config } = v.value;
      const result = insertStmt.run(name, module, description, 'draft', JSON.stringify(config), now, now);
      return rowToAgent(getRow.get(result.lastInsertRowid));
    },

    update(id, input) {
      const existing = getRow.get(id);
      if (!existing) return null;
      if (existing.status !== 'draft') {
        throw new HttpError(409, 'INVALID_STATE', `Only draft agents can be edited (this agent is ${existing.status}).`);
      }
      if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
      }
      const current = rowToAgent(existing);
      const merged = {
        name: input.name ?? current.name,
        module: input.module ?? current.module,
        description: input.description ?? current.description,
        config: input.config ?? current.config,
      };
      const v = input.saveDraft ? validateDraftAgent(merged) : validateAgent(merged);
      if (!v.valid) throw validationError('', v.errors);
      const { name, module, description, config } = v.value;
      const now = new Date().toISOString();
      updateStmt.run(name, module, description, JSON.stringify(config), now, id);
      return rowToAgent(getRow.get(id));
    },

    publish(id) {
      const row = getRow.get(id);
      if (!row) return null;
      if (row.status !== 'draft') {
        throw new HttpError(409, 'INVALID_STATE', `Only draft agents can be published (this agent is ${row.status}).`);
      }
      const v = validateAgent(asAgentInput(rowToAgent(row)));
      if (!v.valid) throw validationError('Cannot publish an invalid configuration: ', v.errors);
      const now = new Date().toISOString();
      publishStmt.run(now, now, id);
      return rowToAgent(getRow.get(id));
    },

    disable(id) {
      const row = getRow.get(id);
      if (!row) return null;
      if (row.status !== 'published') {
        throw new HttpError(409, 'INVALID_STATE', `Only published agents can be disabled (this agent is ${row.status}).`);
      }
      const now = new Date().toISOString();
      disableStmt.run(now, id);
      return rowToAgent(getRow.get(id));
    },
  };
}

module.exports = { createAgentService };
