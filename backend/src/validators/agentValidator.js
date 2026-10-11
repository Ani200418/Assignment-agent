// Server-side validation. The frontend validates too (for fast feedback),
// but the server is the real gatekeeper: it never trusts the client.
const { MODULES, CHANNELS, RECIPIENTS, ACTIONS, findTrigger } = require('../config/agentDefinitions');

const STATUSES = ['draft', 'published', 'disabled'];
const LIMITS = { name: 100, description: 500, message: 1000 };

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isBlank = (v) => typeof v !== 'string' || !v.trim();

// Validates one agent configuration against its module's definitions.
// Returns a NORMALISED copy (trimmed text, only the conditions this trigger uses),
// so unknown/irrelevant keys never get stored.
// Missing condition value => the trigger's default is applied (keeps older saved agents working).
function validateConfig(module, c) {
  if (!isPlainObject(c)) return { valid: false, errors: ['Configuration is required.'], config: null };
  const errors = [];
  const moduleKnown = MODULES.includes(module);
  const trigger = moduleKnown ? findTrigger(module, c.trigger) : null;

  if (isBlank(c.trigger)) errors.push('Trigger is required.');
  else if (moduleKnown && !trigger) errors.push(`Trigger "${c.trigger}" is not available for the ${module} module.`);

  const conditions = {};
  if (trigger && trigger.condition) {
    const { key, label, min, max, default: dflt } = trigger.condition;
    const raw = isPlainObject(c.conditions) ? c.conditions[key] : undefined;
    if (raw === undefined || raw === null || raw === '') conditions[key] = dflt;
    else if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < min || raw > max) {
      errors.push(`${label} must be a whole number between ${min} and ${max}.`);
    } else conditions[key] = raw;
  }

  if (isBlank(c.recipient)) errors.push('Recipient is required.');
  else if (!RECIPIENTS.includes(c.recipient)) errors.push(`Recipient must be one of: ${RECIPIENTS.join(', ')}.`);

  if (!CHANNELS.includes(c.channel)) errors.push(`Channel must be one of: ${CHANNELS.join(', ')}.`);

  if (isBlank(c.action)) errors.push('Action is required.');
  else if (!ACTIONS.includes(c.action)) errors.push(`Action must be one of: ${ACTIONS.join(', ')}.`);

  if (isBlank(c.message)) errors.push('Message template is required.');
  else if (c.message.trim().length > LIMITS.message) errors.push(`Message must be ${LIMITS.message} characters or fewer.`);

  if (errors.length) return { valid: false, errors, config: null };
  return {
    valid: true,
    errors: [],
    config: { trigger: c.trigger, conditions, recipient: c.recipient, channel: c.channel, action: c.action, message: c.message.trim() },
  };
}

// Validates a whole agent (name, module, description, config).
function validateAgent(input) {
  if (!isPlainObject(input)) return { valid: false, errors: ['Request body must be a JSON object.'], value: null };
  const errors = [];

  if (isBlank(input.name)) errors.push('Name is required.');
  else if (input.name.trim().length > LIMITS.name) errors.push(`Name must be ${LIMITS.name} characters or fewer.`);

  if (!MODULES.includes(input.module)) errors.push('Module must be Task, DSC, or License.');

  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== 'string') errors.push('Description must be text.');
    else if (input.description.trim().length > LIMITS.description) errors.push(`Description must be ${LIMITS.description} characters or fewer.`);
  }

  if (input.status !== undefined && !STATUSES.includes(input.status)) errors.push('Invalid status.');

  const cfg = validateConfig(input.module, input.config);
  errors.push(...cfg.errors);

  if (errors.length) return { valid: false, errors, value: null };
  return {
    valid: true,
    errors: [],
    value: {
      name: input.name.trim(),
      module: input.module,
      description: typeof input.description === 'string' ? input.description.trim() : '',
      config: cfg.config,
    },
  };
}

module.exports = { validateAgent, validateConfig, MODULES, STATUSES, LIMITS };
