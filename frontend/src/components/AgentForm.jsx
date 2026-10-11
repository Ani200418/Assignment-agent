'use client';
// One form used for BOTH "Create agent" and "Edit draft".
//   <AgentForm />            -> create
//   <AgentForm agent={a} />  -> edit an existing draft
// Flow shown to the user: Trigger -> Conditions -> Recipient -> Channel -> Action/Message -> Preview -> Save/Publish
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { createAgent, getAgentDefinitions, publishAgent, updateAgent } from '../services/agentApi';

const LIMITS = { name: 100, description: 500, message: 1000 };
const FIELD = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100';
const CARD = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';

// ---- pure helpers (no React) ----
const findTrigger = (defs, module, value) => defs.modules[module]?.triggers.find((t) => t.value === value);

// Condition values are kept as strings while typing, so the box can be temporarily empty.
function conditionsFor(trigger, existing = {}) {
  if (!trigger?.condition) return {};
  const { key, default: dflt } = trigger.condition;
  return { [key]: String(existing[key] ?? dflt) };
}

function blankForm(defs, module = 'Task') {
  const def = defs.modules[module];
  const trigger = def.triggers[0];
  return {
    name: '', module, description: '',
    trigger: trigger.value, conditions: conditionsFor(trigger),
    recipient: defs.recipients[0], channel: defs.channels[0], action: defs.actions[0],
    message: def.defaultMessage,
  };
}

function formFromAgent(defs, agent) {
  const def = defs.modules[agent.module];
  const trigger = findTrigger(defs, agent.module, agent.config.trigger) || def.triggers[0];
  return {
    name: agent.name, module: agent.module, description: agent.description || '',
    trigger: trigger.value, conditions: conditionsFor(trigger, agent.config.conditions || {}),
    recipient: agent.config.recipient || defs.recipients[0],
    channel: agent.config.channel || defs.channels[0],
    action: agent.config.action || defs.actions[0],
    message: agent.config.message ?? def.defaultMessage,
  };
}

// Same rules as the server (backend/src/validators/agentValidator.js); the server stays the authority.
function validateForm(form, defs) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Agent name is required.';
  else if (form.name.trim().length > LIMITS.name) errors.name = `Agent name must be ${LIMITS.name} characters or fewer.`;
  if (form.description.trim().length > LIMITS.description) errors.description = `Description must be ${LIMITS.description} characters or fewer.`;
  if (!findTrigger(defs, form.module, form.trigger)) errors.trigger = 'Choose a trigger.';
  const condition = findTrigger(defs, form.module, form.trigger)?.condition;
  if (condition) {
    const raw = String(form.conditions[condition.key] ?? '').trim();
    const n = Number(raw);
    if (raw === '' || !Number.isInteger(n) || n < condition.min || n > condition.max) {
      errors.condition = `${condition.label} must be a whole number between ${condition.min} and ${condition.max}.`;
    }
  }
  if (!defs.recipients.includes(form.recipient)) errors.recipient = 'Choose a recipient.';
  if (!defs.channels.includes(form.channel)) errors.channel = 'Choose a channel.';
  if (!defs.actions.includes(form.action)) errors.action = 'Choose an action.';
  if (!form.message.trim()) errors.message = 'Message template is required.';
  else if (form.message.trim().length > LIMITS.message) errors.message = `Message must be ${LIMITS.message} characters or fewer.`;
  return errors;
}

function buildPayload(form, defs) {
  const condition = findTrigger(defs, form.module, form.trigger)?.condition;
  const conditions = condition ? { [condition.key]: Number(form.conditions[condition.key]) } : {};
  return {
    name: form.name.trim(), module: form.module, description: form.description.trim(),
    config: { trigger: form.trigger, conditions, recipient: form.recipient, channel: form.channel, action: form.action, message: form.message.trim() },
  };
}

// ---- small presentational pieces ----
function FieldError({ id, message }) {
  return message ? <p id={id} className="mt-1 text-xs font-medium text-rose-600">{message}</p> : null;
}

// ---- outer component: loads the definitions, then renders the form ----
export default function AgentForm({ agent = null }) {
  const [defs, setDefs] = useState(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    getAgentDefinitions().then(setDefs).catch((e) => setLoadError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loadError) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">
        <p className="font-semibold">The agent form could not be loaded.</p>
        <p className="mt-1">{loadError}</p>
        <button type="button" onClick={load} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Try again</button>
      </div>
    );
  }
  if (!defs) return <p className="p-6 text-sm text-slate-500">Loading form…</p>;
  return <FormBody defs={defs} agent={agent} />;
}

function FormBody({ defs, agent }) {
  const router = useRouter();
  const editing = Boolean(agent);
  const [form, setForm] = useState(() => (agent ? formFromAgent(defs, agent) : blankForm(defs)));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  // Once the agent exists on the server, further saves UPDATE it. This prevents duplicates when
  // "Publish" creates the draft successfully but the publish step fails and the user tries again.
  const [savedId, setSavedId] = useState(agent ? agent.id : null);

  const moduleDef = defs.modules[form.module];
  const triggerDef = findTrigger(defs, form.module, form.trigger);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  function changeModule(module) {
    setForm((f) => {
      const next = blankForm(defs, module);
      const messageUntouched = !f.message.trim() || f.message === defs.modules[f.module].defaultMessage;
      return { ...f, module, trigger: next.trigger, conditions: next.conditions, message: messageUntouched ? next.message : f.message };
    });
  }
  function changeTrigger(value) {
    setForm((f) => ({ ...f, trigger: value, conditions: conditionsFor(findTrigger(defs, f.module, value), f.conditions) }));
  }

  async function save(publish) {
    const found = validateForm(form, defs);
    setErrors(found);
    if (Object.keys(found).length > 0) { setFormError('Please fix the highlighted fields.'); return; }
    setFormError('');
    setBusy(true);
    const payload = buildPayload(form, defs);
    let id = savedId;
    try {
      if (id === null) { id = (await createAgent(payload)).id; setSavedId(id); }
      else await updateAgent(id, payload);
    } catch (e) { setFormError(e.message); setBusy(false); return; }
    if (publish) {
      try { await publishAgent(id); }
      catch (e) { setFormError(`Your agent was saved as a draft, but publishing failed: ${e.message}`); setBusy(false); return; }
    }
    router.push(`/agents/${id}`);
  }

  const aria = (key) => ({ 'aria-invalid': errors[key] ? true : undefined, 'aria-describedby': errors[key] ? `${key}-error` : undefined });

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={editing ? `/agents/${agent.id}` : '/agent-center'} className="text-sm font-medium text-slate-500 hover:text-violet-700">
        ← Back to {editing ? 'agent' : 'Agent Center'}
      </Link>
      <div className="mb-7 mt-4">
        <p className="text-sm font-semibold text-violet-700">AGENT BUILDER</p>
        <h1 className="mt-2 text-3xl font-bold">{editing ? 'Edit draft agent' : 'Create an agent'}</h1>
        <p className="mt-2 text-slate-500">Configure when this agent runs and what it should do.</p>
      </div>
      {formError && <div role="alert" className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{formError}</div>}

      <form noValidate onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-5">
        <section className={CARD}>
          <h2 className="font-bold">1. Basic details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Agent name
              <input value={form.name} maxLength={LIMITS.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Task due reminder" className={FIELD} {...aria('name')} />
              <FieldError id="name-error" message={errors.name} />
            </label>
            <label className="text-sm font-medium">Module
              <select value={form.module} onChange={(e) => changeModule(e.target.value)} className={FIELD}>
                {Object.keys(defs.modules).map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium sm:col-span-2">Description <span className="font-normal text-slate-400">(optional)</span>
              <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What does this agent do?" className={FIELD} {...aria('description')} />
              <FieldError id="description-error" message={errors.description} />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">{moduleDef.description}</p>
        </section>

        <section className={CARD}>
          <h2 className="font-bold">2. Trigger and conditions</h2>
          <label className="mt-4 block text-sm font-medium">When should it run?
            <select value={form.trigger} onChange={(e) => changeTrigger(e.target.value)} className={FIELD} {...aria('trigger')}>
              {moduleDef.triggers.map((t) => <option key={t.value}>{t.value}</option>)}
            </select>
            <FieldError id="trigger-error" message={errors.trigger} />
          </label>
          {triggerDef?.condition ? (
            <label className="mt-4 block text-sm font-medium">{triggerDef.condition.label}
              <input type="number" inputMode="numeric" step={1} min={triggerDef.condition.min} max={triggerDef.condition.max}
                value={form.conditions[triggerDef.condition.key] ?? ''}
                onChange={(e) => set('conditions', { [triggerDef.condition.key]: e.target.value })}
                className={`${FIELD} sm:w-48`} {...aria('condition')} />
              <span className="mt-1 block text-xs font-normal text-slate-500">Between {triggerDef.condition.min} and {triggerDef.condition.max}.</span>
              <FieldError id="condition-error" message={errors.condition} />
            </label>
          ) : (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">This trigger needs no extra conditions: the agent reacts to the event itself.</p>
          )}
        </section>

        <section className={CARD}>
          <h2 className="font-bold">3. Recipient and channel</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Recipient
              <select value={form.recipient} onChange={(e) => set('recipient', e.target.value)} className={FIELD} {...aria('recipient')}>
                {defs.recipients.map((x) => <option key={x}>{x}</option>)}
              </select>
              <FieldError id="recipient-error" message={errors.recipient} />
            </label>
            <label className="text-sm font-medium">Channel
              <select value={form.channel} onChange={(e) => set('channel', e.target.value)} className={FIELD} {...aria('channel')}>
                {defs.channels.map((x) => <option key={x}>{x}</option>)}
              </select>
              <FieldError id="channel-error" message={errors.channel} />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">Channel selection is stored as configuration. No real messages are sent in this demo.</p>
        </section>

        <section className={CARD}>
          <h2 className="font-bold">4. Action and message</h2>
          <label className="mt-4 block text-sm font-medium">Action
            <select value={form.action} onChange={(e) => set('action', e.target.value)} className={FIELD} {...aria('action')}>
              {defs.actions.map((x) => <option key={x}>{x}</option>)}
            </select>
            <FieldError id="action-error" message={errors.action} />
          </label>
          <label className="mt-4 block text-sm font-medium">Message template
            <textarea rows={4} value={form.message} onChange={(e) => set('message', e.target.value)} className={FIELD} {...aria('message')} />
            <FieldError id="message-error" message={errors.message} />
          </label>
          <div className="mt-4 rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-4" aria-live="polite">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Preview</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{form.message || '—'}</p>
            <p className="mt-3 text-xs text-slate-500">
              {form.module} · {form.trigger}
              {triggerDef?.condition ? ` (${triggerDef.condition.label.toLowerCase()}: ${form.conditions[triggerDef.condition.key] || '—'})` : ''}
              {' · '}{form.recipient} · {form.channel} · {form.action}
            </p>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3">
          <Link href={editing ? `/agents/${agent.id}` : '/agent-center'} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold">Cancel</Link>
          <button type="button" disabled={busy} onClick={() => save(true)} className="rounded-xl border border-violet-200 bg-white px-5 py-3 text-sm font-semibold text-violet-700 disabled:opacity-50">
            {busy ? 'Saving…' : 'Publish agent'}
          </button>
          <button type="submit" disabled={busy} className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Saving…' : 'Save draft'}
          </button>
        </div>
      </form>
    </div>
  );
}
