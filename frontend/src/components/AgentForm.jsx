'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createAgent, getAgentDefinitions, publishAgent, updateAgent } from '../services/agentApi';
import { FALLBACK_AGENT_DEFINITIONS } from '../config/agentDefinitions';

const LIMITS = { name: 100, description: 500, message: 1000 };
const STEPS = ['event', 'recipient', 'channel', 'action'];
const descriptions = {
  'Task created': 'When a new task is created',
  'Task assigned': 'When a task is assigned to a user',
  'Task due soon': 'When a task is approaching its due date',
  'Task Completed & Final Document Uploaded': 'When a task is completed and the final document is uploaded',
  'Comment Added': 'When a comment is added to a task',
  'Timesheet Log Added': 'When a timesheet log is added',
  'Expense Added': 'When an expense is added to a task',
  'Due Date Approaching': 'When a task is approaching its due date',
  'Due Date Changed': 'When a task due date changes',
  'Priority Changed': 'When a task priority changes',
  'Status Changed': 'When a task status changes',
  'Task Completed': 'When a task is completed',
  'Task Deleted': 'When a task is deleted',
  'Task Sent for Review': 'When a task is sent for review',
  'Task Put on Hold': 'When a task is put on hold',
  'Sub-Status Changed': 'When a task sub-status changes',
  'Subtask Status Changed': 'When a subtask status changes',
  'Files Uploaded': 'When files are uploaded to a task',
  'DSC expiry approaching': 'When a certificate is approaching expiry',
  'DSC expired': 'When a certificate has expired',
  'License expiry approaching': 'When a license is approaching expiry',
  'License expired': 'When a license has expired',
  'Renewal required': 'When renewal is required',
};

const triggerFor = (defs, module, value) => defs.modules[module]?.triggers.find((x) => x.value === value);
const initialConfig = () => ({});

function fromAgent(agent) {
  return {
    name: agent.name,
    module: agent.module,
    description: agent.description || '',
    config: { ...(agent.config || {}) },
  };
}

function fullErrors(form, defs) {
  const c = form.config;
  const errors = [];
  if (!form.name.trim()) errors.push('Agent name is required.');
  if (!triggerFor(defs, form.module, c.trigger)) errors.push('Choose an event.');
  const trigger = triggerFor(defs, form.module, c.trigger);
  if (trigger?.condition) {
    const value = Number(c.conditions?.[trigger.condition.key]);
    if (!Number.isInteger(value) || value < trigger.condition.min || value > trigger.condition.max) {
      errors.push(`${trigger.condition.label} must be a whole number between ${trigger.condition.min} and ${trigger.condition.max}.`);
    }
  }
  if (!defs.recipients.includes(c.recipient)) errors.push('Choose at least one recipient.');
  if (!defs.channels.includes(c.channel)) errors.push('Choose a channel.');
  if (!defs.actions.includes(c.action)) errors.push('Choose an action.');
  if (!String(c.message || '').trim()) errors.push('Choose or write a message template.');
  if (String(c.message || '').length > LIMITS.message) errors.push(`Message must be ${LIMITS.message} characters or fewer.`);
  return errors;
}

function stepComplete(step, form, defs) {
  const c = form.config;
  if (step === 'event') {
    const trigger = triggerFor(defs, form.module, c.trigger);
    if (!trigger) return false;
    if (!trigger.condition) return true;
    const value = Number(c.conditions?.[trigger.condition.key]);
    return Number.isInteger(value) && value >= trigger.condition.min && value <= trigger.condition.max;
  }
  if (step === 'recipient') return defs.recipients.includes(c.recipient);
  if (step === 'channel') return defs.channels.includes(c.channel);
  return defs.actions.includes(c.action) && Boolean(String(c.message || '').trim()) && String(c.message || '').length <= LIMITS.message;
}

function payload(form) {
  return { name: form.name.trim(), module: form.module, description: form.description.trim(), config: form.config };
}

export default function AgentForm({ agent = null }) {
  const [defs, setDefs] = useState(FALLBACK_AGENT_DEFINITIONS);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    getAgentDefinitions().then(setDefs).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  const requested = typeof window === 'undefined' ? 'Task' : new URLSearchParams(window.location.search).get('module');
  const module = agent?.module || (defs.modules[requested] ? requested : 'Task');
  return <Builder defs={defs} agent={agent} initialModule={module} />;
}

function Builder({ defs, agent, initialModule }) {
  const router = useRouter();
  const editing = Boolean(agent);
  const [form, setForm] = useState(() => agent ? fromAgent(agent) : {
    name: `${initialModule} Agent`, module: initialModule, description: '', config: initialConfig(),
  });
  const [panel, setPanel] = useState('event');
  const [savedId, setSavedId] = useState(agent?.id || null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);

  const completed = useMemo(() => Object.fromEntries(STEPS.map((s) => [s, stepComplete(s, form, defs)])), [form, defs]);
  const unlocked = (step) => {
    const index = STEPS.indexOf(step);
    return index === 0 || STEPS.slice(0, index).every((s) => completed[s]);
  };
  const trigger = triggerFor(defs, form.module, form.config.trigger);

  function patchConfig(patch) {
    setForm((current) => ({ ...current, config: { ...current.config, ...patch } }));
  }
  function changeStep(step) {
    if (!unlocked(step)) {
      setNotice(`Complete ${STEPS[STEPS.indexOf(step) - 1]} before opening this step.`);
      return;
    }
    setNotice('');
    setPanel(step);
  }
  function chooseEvent(value) {
    const next = triggerFor(defs, form.module, value);
    const conditions = next?.condition ? { [next.condition.key]: next.condition.default } : {};
    setForm((current) => ({ ...current, config: { trigger: value, conditions } }));
  }
  function chooseRecipient(value) {
    setForm((current) => ({ ...current, config: { trigger: current.config.trigger, conditions: current.config.conditions, recipient: value } }));
  }
  function chooseChannel(value) {
    setForm((current) => ({ ...current, config: { ...current.config, channel: value, action: undefined, message: undefined } }));
  }
  function chooseAction(value) {
    setForm((current) => ({ ...current, config: { ...current.config, action: value } }));
  }
  function changeModule(module) {
    setForm((current) => ({ ...current, module, name: `${module} Agent`, config: {} }));
    setPanel('event');
  }

  async function save(publish = false) {
    setNotice('');
    const errors = publish ? fullErrors(form, defs) : (!form.name.trim() ? ['Agent name is required.'] : []);
    if (errors.length) { setNotice(errors.join(' ')); return; }
    setBusy(true);
    try {
      const body = { ...payload(form), saveDraft: !publish };
      let id = savedId;
      if (id === null) {
        const created = await createAgent(body);
        id = created.id;
        setSavedId(id);
      } else {
        await updateAgent(id, body);
      }
      if (publish) {
        await publishAgent(id);
        router.push(`/agents/${id}`);
      } else {
        setNotice('Draft saved. Your current step configuration is stored.');
        if (!savedId) router.replace(`/agents/${id}/edit`);
      }
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  const stepData = {
    event: { label: 'EVENT', title: completed.event ? form.config.trigger : 'Select Event', detail: completed.event ? (trigger?.condition ? `${trigger.condition.label}: ${form.config.conditions[trigger.condition.key]}` : descriptions[form.config.trigger]) : 'Click to choose a trigger event', tone: 'orange' },
    recipient: { label: 'RECIPIENT', title: completed.recipient ? form.config.recipient : 'Select Recipients', detail: completed.recipient ? 'Notification targets' : 'Select who receives the notification', tone: 'purple' },
    channel: { label: 'CHANNEL', title: completed.channel ? form.config.channel : 'Select Channel', detail: completed.channel ? 'Delivery channel' : 'Click to choose delivery channel', tone: 'green' },
    action: { label: 'ACTION', title: completed.action ? 'Action Configured' : 'Configure Action', detail: completed.action ? form.config.action : 'Click to write the message', tone: 'cyan' },
  };

  return (
    <div className="builder-canvas">
      <div className="builder-header">
        <Link href={editing ? `/agents/${agent.id}` : '/agent-center'} className="crumb">Agent Center&nbsp; › &nbsp;{form.module}&nbsp; › &nbsp;Create Agents</Link>
        <h1>{form.module} Agents</h1>
        <div className="builder-actions">
          <button type="button" onClick={() => save(false)} disabled={busy}>▣&nbsp; Save Draft</button>
          <button type="button" onClick={() => setPreview(!preview)} className="preview-button">⌕&nbsp; Preview</button>
          <button type="button" onClick={() => save(true)} disabled={busy}>✓&nbsp; Publish</button>
        </div>
      </div>
      <div className="builder-subbar">
        <label>Module <select value={form.module} onChange={(e) => changeModule(e.target.value)}>{Object.keys(defs.modules).map((m) => <option key={m}>{m}</option>)}</select></label>
        <span>{form.description || defs.modules[form.module].description}</span>
      </div>
      {notice && <p className="builder-notice" role="status">{notice}</p>}
      <div className="workflow-row">
        {STEPS.map((step, index) => (
          <div className={`workflow-slot ${panel === step && !preview ? 'workflow-slot-expanded' : ''}`} key={step}>
            <button type="button" className={`workflow-node ${stepData[step].tone} ${completed[step] ? 'complete' : ''} ${!unlocked(step) ? 'locked' : ''} ${panel === step ? 'selected' : ''}`} onClick={() => changeStep(step)} disabled={!unlocked(step)} aria-disabled={!unlocked(step)}>
              <span className="node-label">{stepData[step].label} {completed[step] && <b className="node-check">✓</b>}</span>
              <strong>{stepData[step].title}</strong>
              <p>{stepData[step].detail}</p>
              {!unlocked(step) && <span className="node-lock">○</span>}
            </button>
            {index < STEPS.length - 1 && <span className="workflow-connector" aria-hidden="true">›</span>}
            {!preview && panel === step && <Drawer panel={panel} defs={defs} form={form} completed={completed} onEvent={chooseEvent} onRecipient={chooseRecipient} onChannel={chooseChannel} onAction={chooseAction} onMessage={(message) => patchConfig({ message })} onCondition={(value) => patchConfig({ conditions: { [trigger?.condition?.key]: Number(value) } })} onDone={() => setPanel(STEPS[Math.min(STEPS.indexOf(panel) + 1, 3)])} onClose={() => setPanel(null)} />}
          </div>
        ))}
      </div>
      {preview && <div className="builder-workspace"><Preview form={form} defs={defs} /></div>}
    </div>
  );
}

function Drawer({ panel, defs, form, completed, onEvent, onRecipient, onChannel, onAction, onMessage, onCondition, onDone, onClose }) {
  const c = form.config;
  const trigger = triggerFor(defs, form.module, c.trigger);
  return (
    <aside className={`config-drawer drawer-${panel}`}>
      <div className="drawer-title"><span><b>{panel === 'event' ? 'Configure Trigger' : panel === 'recipient' ? 'Select Recipients' : panel === 'channel' ? 'Configure Channel' : 'Configure Action'}</b><small>{form.module} Agents</small></span><button type="button" aria-label="Close panel" onClick={onClose}>×</button></div>
      {panel === 'event' && <EventPanel defs={defs} form={form} trigger={trigger} onEvent={onEvent} onCondition={onCondition} />}
      {panel === 'recipient' && <OptionPanel label="Who should receive this notification?" options={defs.recipients} value={c.recipient} onChange={onRecipient} />}
      {panel === 'channel' && <ChannelPanel defs={defs} value={c.channel} onChange={onChannel} />}
      {panel === 'action' && <ActionPanel defs={defs} form={form} onAction={onAction} onMessage={onMessage} />}
      <div className="drawer-footer"><button type="button" className="drawer-cancel" onClick={onClose}>Cancel</button><button type="button" className="drawer-primary" onClick={onDone} disabled={!completed[panel]}>{panel === 'action' ? 'Done' : `Select ${panel === 'event' ? 'Event' : panel === 'recipient' ? 'Recipients' : 'Channel'}`}</button></div>
    </aside>
  );
}

function EventPanel({ defs, form, trigger, onEvent, onCondition }) {
  return <div className="drawer-content"><label className="drawer-label">Select Trigger Event</label><div className="search-box">⌕&nbsp; Search event</div><div className="option-list">{defs.modules[form.module].triggers.map((item) => <button type="button" key={item.value} className={`option-row ${form.config.trigger === item.value ? 'active' : ''}`} onClick={() => onEvent(item.value)}><span><b>{item.value}</b><small>{descriptions[item.value] || `When ${item.value.toLowerCase()}`}</small></span>{form.config.trigger === item.value && <i>✓</i>}</button>)}</div>{trigger?.condition && <label className="condition-field">{trigger.condition.label}<input type="number" min={trigger.condition.min} max={trigger.condition.max} value={form.config.conditions?.[trigger.condition.key] ?? ''} onChange={(e) => onCondition(e.target.value)} /><small>Between {trigger.condition.min} and {trigger.condition.max}</small></label>}</div>;
}

function OptionPanel({ label, options, value, onChange }) {
  return <div className="drawer-content"><label className="drawer-label">{label}</label><div className="option-list">{options.map((item) => <button type="button" key={item} className={`option-row ${value === item ? 'active' : ''}`} onClick={() => onChange(item)}><span><b>{item}</b><small>Use this recipient category</small></span>{value === item && <i>✓</i>}</button>)}</div></div>;
}

function ChannelPanel({ defs, value, onChange }) {
  return <div className="drawer-content"><label className="drawer-label">Choose a channel for this automation</label><div className="option-list">{defs.channels.map((item) => <button type="button" key={item} className={`option-row channel-option ${value === item ? 'active' : ''}`} onClick={() => onChange(item)}><span><b>{item}</b><small>{item === 'WhatsApp' ? 'Connection required; not sent in this demo' : item === 'Email' ? 'Email delivery channel' : 'In-app notification'}</small></span>{value === item && <i>✓</i>}</button>)}</div><p className="drawer-help">Channel selection is saved as configuration. No external message is delivered by this demo.</p></div>;
}

function ActionPanel({ defs, form, onAction, onMessage }) {
  return <div className="drawer-content"><label className="drawer-label">What should happen after the event?</label><div className="action-choice">{defs.actions.map((item) => <button type="button" key={item} className={form.config.action === item ? 'active' : ''} onClick={() => onAction(item)}>▣&nbsp; {item}</button>)}</div><label className="drawer-label">Use a Template <span>(optional)</span></label><div className="template-tabs"><span className="active">Task</span><span>Personal</span></div><div className="template-list">{defs.actions.map((item) => <button type="button" key={item} onClick={() => { onAction(item); onMessage(`${item} for {{task.title}}. Please review the details.`); }}><b>{item}</b><small>Message template</small></button>)}</div><label className="drawer-label">Message preview</label><textarea rows={5} value={form.config.message || ''} onChange={(e) => onMessage(e.target.value)} placeholder="Write the notification message…" /></div>;
}

function Preview({ form, defs }) {
  const c = form.config;
  return <section className="message-preview"><div className="preview-heading"><span>MESSAGE PREVIEW</span><span>{c.channel || 'Channel not selected'}</span></div><div className="preview-columns"><article><b>ASSIGNED USER</b><h3>{c.action || 'Action not configured'}</h3><p>{c.message || 'Complete Action configuration to preview the message.'}</p><small>{form.module} · {c.trigger || 'Event not selected'} · {c.recipient || 'Recipient not selected'}</small></article><article><b>MANAGER</b><h3>{defs.modules[form.module].description}</h3><p>{c.message || 'The configured message will appear here.'}</p><small>Simulated preview only</small></article></div></section>;
}
