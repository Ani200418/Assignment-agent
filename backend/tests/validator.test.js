const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateAgent, validateConfig } = require('../src/validators/agentValidator');
const { validAgent, MODULES } = require('./helpers');

describe('validateAgent: valid input', () => {
  for (const module of MODULES) {
    test(`accepts a valid ${module} agent`, () => {
      const r = validateAgent(validAgent(module));
      assert.equal(r.valid, true, r.errors.join(' | '));
      assert.equal(r.value.module, module);
    });
  }

  test('trims text and treats a missing description as empty', () => {
    const body = validAgent('Task', { name: '  Padded name  ' });
    delete body.description;
    const r = validateAgent(body);
    assert.equal(r.value.name, 'Padded name');
    assert.equal(r.value.description, '');
  });

  test('applies the trigger default when the condition is missing', () => {
    const r = validateAgent(validAgent('DSC', { config: { conditions: {} } }));
    assert.deepEqual(r.value.config.conditions, { daysBeforeExpiry: 30 });
  });

  test('keeps only the condition the chosen trigger uses (strips irrelevant keys)', () => {
    const r = validateAgent(validAgent('Task', { config: { trigger: 'Task created', conditions: { daysBeforeExpiry: 30 } } }));
    assert.equal(r.valid, true);
    assert.deepEqual(r.value.config.conditions, {});
  });

  test('older saved Task agents with the legacy {daysBeforeExpiry:30} condition still validate', () => {
    const r = validateAgent(validAgent('Task', { config: { trigger: 'Task due soon', conditions: { daysBeforeExpiry: 30 } } }));
    assert.equal(r.valid, true);
    assert.deepEqual(r.value.config.conditions, { daysBeforeDue: 2 });
  });
});

describe('validateAgent: invalid input', () => {
  const rejects = (label, input, pattern) =>
    test(`rejects ${label}`, () => {
      const r = validateAgent(input);
      assert.equal(r.valid, false);
      assert.match(r.errors.join(' '), pattern);
    });

  rejects('an empty object', {}, /Name is required/);
  rejects('null', null, /JSON object/);
  rejects('an array', [], /JSON object/);
  rejects('a string body', 'hello', /JSON object/);
  rejects('a blank name', validAgent('Task', { name: '   ' }), /Name is required/);
  rejects('a name over 100 characters', validAgent('Task', { name: 'x'.repeat(101) }), /100 characters/);
  rejects('a numeric name', validAgent('Task', { name: 42 }), /Name is required/);
  rejects('an unknown module', validAgent('Task', { module: 'Invoice' }), /Module must be/);
  rejects('a missing module', validAgent('Task', { module: undefined }), /Module must be/);
  rejects('a non-text description', validAgent('Task', { description: 5 }), /Description must be text/);
  rejects('a description over 500 characters', validAgent('Task', { description: 'd'.repeat(501) }), /500 characters/);
  rejects('an invalid status', validAgent('Task', { status: 'archived' }), /Invalid status/);
  rejects('a missing config', { ...validAgent('Task'), config: undefined }, /Configuration is required/);
  rejects('config as an array', { ...validAgent('Task'), config: [] }, /Configuration is required/);
  rejects('a trigger from another module', validAgent('Task', { config: { trigger: 'DSC expired' } }), /not available for the Task module/);
  rejects('an unknown trigger', validAgent('DSC', { config: { trigger: 'Something else' } }), /not available for the DSC module/);
  rejects('a blank trigger', validAgent('Task', { config: { trigger: '' } }), /Trigger is required/);
  rejects('an unknown recipient', validAgent('Task', { config: { recipient: 'Everyone' } }), /Recipient must be/);
  rejects('a blank recipient', validAgent('Task', { config: { recipient: '' } }), /Recipient is required/);
  rejects('an unknown channel', validAgent('Task', { config: { channel: 'Fax' } }), /Channel must be/);
  rejects('an unknown action', validAgent('Task', { config: { action: 'Launch rocket' } }), /Action must be/);
  rejects('an empty message', validAgent('Task', { config: { message: '   ' } }), /Message template is required/);
  rejects('a message over 1000 characters', validAgent('Task', { config: { message: 'm'.repeat(1001) } }), /1000 characters/);
  rejects('a condition below the minimum', validAgent('DSC', { config: { conditions: { daysBeforeExpiry: 0 } } }), /between 1 and 365/);
  rejects('a condition above the maximum', validAgent('DSC', { config: { conditions: { daysBeforeExpiry: 366 } } }), /between 1 and 365/);
  rejects('a fractional condition', validAgent('License', { config: { conditions: { daysBeforeExpiry: 2.5 } } }), /whole number/);
  rejects('a text condition', validAgent('License', { config: { conditions: { daysBeforeExpiry: '30' } } }), /whole number/);

  test('reports ALL problems at once, not just the first', () => {
    const r = validateAgent({ name: '', module: 'Nope', config: {} });
    assert.ok(r.errors.length >= 4, `expected several errors, got: ${r.errors.join(' | ')}`);
  });
});

describe('validateConfig', () => {
  test('rejects a non-object config without throwing', () => {
    assert.equal(validateConfig('Task', null).valid, false);
    assert.equal(validateConfig('Task', 'x').valid, false);
  });
});
