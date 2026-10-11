// SINGLE SOURCE OF TRUTH for what an agent can be configured with.
// To add or rename a trigger, recipient, channel or action, edit THIS file only:
//  - the validator reads it to accept/reject input,
//  - the simulator reads it to build a sample event,
//  - the frontend reads it through GET /api/agent-definitions to build the form.

const CHANNELS = ['Email', 'WhatsApp', 'In-app'];
const RECIPIENTS = ['Assigned user', 'Task owner', 'Account administrator', 'Responsible person'];
const ACTIONS = ['Send notification', 'Send expiry reminder', 'Send renewal reminder', 'Notify assignee'];

// A "condition" is the one extra setting a trigger needs (or null if it needs none).
const expiryCondition = () => ({ key: 'daysBeforeExpiry', label: 'Days before expiry', min: 1, max: 365, default: 30 });
const dueCondition = () => ({ key: 'daysBeforeDue', label: 'Days before due date', min: 1, max: 90, default: 2 });

// Fixed, fictional sample records: the simulator must be deterministic,
// so it never uses the current time or random values.
const SAMPLE_TASK = { id: 'TASK-1001', title: 'Prepare monthly compliance report', createdBy: 'Sample Manager', assignee: 'Sample User', dueDate: '2026-01-15' };
const SAMPLE_DSC = { id: 'DSC-2001', holder: 'Sample User', certificateClass: 'Class 3', expiryDate: '2026-02-01' };
const SAMPLE_LICENSE = { id: 'LIC-3001', name: 'Sample Trade License', owner: 'Sample Company', expiryDate: '2026-02-01' };

const MODULE_DEFINITIONS = {
  Task: {
    description: 'Task creation, assignment notifications, and reminders',
    defaultMessage: 'Hello, this is a reminder regarding your task.',
    triggers: [
      { value: 'Task created', condition: null, sampleEvent: () => ({ event: 'Task created', task: SAMPLE_TASK }) },
      { value: 'Task assigned', condition: null, sampleEvent: () => ({ event: 'Task assigned', task: SAMPLE_TASK, assignedTo: SAMPLE_TASK.assignee }) },
      { value: 'Task due soon', condition: dueCondition(), sampleEvent: (c) => ({ event: 'Task due soon', task: SAMPLE_TASK, daysUntilDue: c.daysBeforeDue }) },
    ],
  },
  DSC: {
    description: 'Digital signature certificate expiry and renewal reminders',
    defaultMessage: 'Your digital signature certificate is approaching expiry.',
    triggers: [
      { value: 'DSC expiry approaching', condition: expiryCondition(), sampleEvent: (c) => ({ event: 'DSC expiry approaching', dsc: SAMPLE_DSC, daysToExpiry: c.daysBeforeExpiry }) },
      { value: 'DSC expired', condition: null, sampleEvent: () => ({ event: 'DSC expired', dsc: SAMPLE_DSC, expired: true }) },
      { value: 'Renewal required', condition: expiryCondition(), sampleEvent: (c) => ({ event: 'Renewal required', dsc: SAMPLE_DSC, renewalWindowDays: c.daysBeforeExpiry }) },
    ],
  },
  License: {
    description: 'License expiry reminders and renewal notifications',
    defaultMessage: 'Your license is approaching expiry.',
    triggers: [
      { value: 'License expiry approaching', condition: expiryCondition(), sampleEvent: (c) => ({ event: 'License expiry approaching', license: SAMPLE_LICENSE, daysToExpiry: c.daysBeforeExpiry }) },
      { value: 'License expired', condition: null, sampleEvent: () => ({ event: 'License expired', license: SAMPLE_LICENSE, expired: true }) },
      { value: 'Renewal required', condition: expiryCondition(), sampleEvent: (c) => ({ event: 'Renewal required', license: SAMPLE_LICENSE, renewalWindowDays: c.daysBeforeExpiry }) },
    ],
  },
};

const MODULES = Object.keys(MODULE_DEFINITIONS);

function findTrigger(module, value) {
  const def = MODULE_DEFINITIONS[module];
  return def ? def.triggers.find((t) => t.value === value) || null : null;
}

// What the frontend receives (no functions, no sample data).
function getPublicDefinitions() {
  const modules = {};
  for (const [name, def] of Object.entries(MODULE_DEFINITIONS)) {
    modules[name] = {
      description: def.description,
      defaultMessage: def.defaultMessage,
      triggers: def.triggers.map((t) => ({ value: t.value, condition: t.condition })),
    };
  }
  return { modules, recipients: RECIPIENTS, channels: CHANNELS, actions: ACTIONS };
}

module.exports = { MODULES, CHANNELS, RECIPIENTS, ACTIONS, MODULE_DEFINITIONS, findTrigger, getPublicDefinitions };
