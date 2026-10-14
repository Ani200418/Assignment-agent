// Public form definitions kept in sync with backend/src/config/agentDefinitions.js.
// They let the builder remain usable as a UI preview when the API is offline.
const expiryCondition = () => ({ key: 'daysBeforeExpiry', label: 'Days before expiry', min: 1, max: 365, default: 30 });
const dueCondition = () => ({ key: 'daysBeforeDue', label: 'Days before due date', min: 1, max: 90, default: 2 });

const triggers = (values, conditionValues = {}) => values.map((value) => ({
  value,
  condition: conditionValues[value] || null,
}));

export const FALLBACK_AGENT_DEFINITIONS = {
  modules: {
    Task: {
      description: 'Task creation, assignment notifications, and reminders',
      defaultMessage: 'Hello, this is a reminder regarding your task.',
      triggers: triggers([
        'Task created', 'Task assigned', 'Task due soon', 'Task Completed & Final Document Uploaded',
        'Comment Added', 'Timesheet Log Added', 'Expense Added', 'Due Date Approaching',
        'Due Date Changed', 'Priority Changed', 'Status Changed', 'Task Completed', 'Task Deleted',
        'Task Sent for Review', 'Task Put on Hold', 'Sub-Status Changed', 'Subtask Status Changed',
        'Files Uploaded',
      ], { 'Task due soon': dueCondition(), 'Due Date Approaching': dueCondition() }),
    },
    DSC: {
      description: 'Digital signature certificate expiry and renewal reminders',
      defaultMessage: 'Your digital signature certificate is approaching expiry.',
      triggers: triggers(['DSC expiry approaching', 'DSC expired', 'Renewal required'], {
        'DSC expiry approaching': expiryCondition(), 'Renewal required': expiryCondition(),
      }),
    },
    License: {
      description: 'License expiry reminders and renewal notifications',
      defaultMessage: 'Your license is approaching expiry.',
      triggers: triggers(['License expiry approaching', 'License expired', 'Renewal required'], {
        'License expiry approaching': expiryCondition(), 'Renewal required': expiryCondition(),
      }),
    },
  },
  recipients: ['Assigned user', 'Task owner', 'Account administrator', 'Responsible person'],
  channels: ['Email', 'WhatsApp', 'In-app'],
  actions: ['Send notification', 'Send expiry reminder', 'Send renewal reminder', 'Notify assignee'],
};
