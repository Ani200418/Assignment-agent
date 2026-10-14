'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { disableAgent, getAgent, getAgentHistory, publishAgent, testRunAgent } from '../../../services/agentApi';
import { Status } from '../../../components/Shell';
import { RunDetails } from '../../../components/RunDetails';
import { describeConditions, formatDateTime } from '../../../lib/format';

const ACTIONS = { publish: publishAgent, disable: disableAgent, 'test-run': testRunAgent };

export default function AgentDetail() {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [runs, setRuns] = useState([]);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState(null); // { type, text }
  const [busy, setBusy] = useState(false);
  const [openRun, setOpenRun] = useState(null);

  const load = useCallback(async (userInitiated = false) => {
    setError('');
    setHistoryError('');
    try {
      const [agentResult, historyResult] = await Promise.allSettled([
        getAgent(id, { userInitiated }),
        getAgentHistory(id, { userInitiated }),
      ]);
      if (agentResult.status === 'fulfilled') setAgent(agentResult.value);
      else if (userInitiated) setError(agentResult.reason.message);
      if (historyResult.status === 'fulfilled') {
        setRuns(historyResult.value);
        setHistoryUnavailable(false);
      }
      else {
        setHistoryUnavailable(true);
        if (userInitiated) setHistoryError(historyResult.reason.message);
      }
    } catch (e) { if (userInitiated) setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Order matters: do the action, REFRESH from the server, and only then show the message.
  // Otherwise the page can say "published" while still showing the old status and buttons,
  // and a refresh would also wipe the error of a rejected action.
  async function act(verb) {
    setBusy(true); setError(''); setNotice(null);
    let message = null;
    let failure = '';
    try {
      const result = await ACTIONS[verb](id);
      if (verb === 'test-run') {
        message = result.status === 'failed'
          ? { type: 'error', text: `Simulated test run FAILED: ${result.error_message}` }
          : { type: 'success', text: 'Simulated test run completed. No real notification was sent.' };
        setOpenRun(result.id);
      } else {
        message = { type: 'success', text: verb === 'publish' ? 'Agent published.' : 'Agent disabled.' };
      }
    } catch (e) {
      failure = e.message;
    }
    await load(); // always re-read the real state, even after a failed action
    if (failure) setError(failure);
    else setNotice(message);
    setBusy(false);
  }

  if (!agent) {
    return (
      <>
        <Link href="/agent-center" className="text-sm text-violet-700">← Agent Center</Link>
        {error ? <div role="alert" className="mt-6 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"><p>{error}</p><button type="button" onClick={() => load(true)} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Try again</button></div> : <p className="mt-6">{agent === null ? 'Agent details are unavailable.' : 'Loading agent…'}</p>}
      </>
    );
  }

  const cfg = agent.config || {};
  const details = [
    ['Trigger', cfg.trigger], ['Conditions', describeConditions(cfg.conditions)], ['Recipient', cfg.recipient],
    ['Channel', cfg.channel], ['Action', cfg.action], ['Message', cfg.message],
  ];

  return (
    <>
      <div className="mx-auto max-w-4xl">
        <Link href="/agent-center" className="text-sm text-slate-500 hover:text-violet-700">← Back to Agent Center</Link>
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-violet-700">{agent.module.toUpperCase()} AGENT</p>
            <h1 className="mt-2 text-3xl font-bold">{agent.name}</h1>
            <p className="mt-2 text-slate-500">{agent.description || 'No description provided.'}</p>
            <div className="mt-3"><Status status={agent.status} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {agent.status === 'draft' && <>
              <Link href={`/agents/${agent.id}/edit`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Edit</Link>
              <button type="button" disabled={busy} onClick={() => act('publish')} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Publish</button>
            </>}
            {agent.status === 'published' && <>
              <button type="button" disabled={busy} onClick={() => act('test-run')} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Run test (simulated)</button>
              <button type="button" disabled={busy} onClick={() => act('disable')} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Disable</button>
            </>}
          </div>
        </div>

        {notice && <p role={notice.type === 'error' ? 'alert' : 'status'} className={`mt-5 rounded-lg p-3 text-sm ${notice.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>{notice.text}</p>}
        {error && <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {historyError && <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{historyError} <button type="button" onClick={load} className="ml-2 font-semibold underline">Retry</button></p>}
        {agent.status === 'published' && <p className="mt-5 text-xs text-slate-500">Published agents are read-only. Test runs are simulated and send nothing.</p>}
        {agent.status === 'disabled' && <p className="mt-5 text-xs text-slate-500">This agent is disabled. It cannot be edited, published, or test-run.</p>}

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-bold">Configuration</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
                <dd className="mt-2 whitespace-pre-wrap break-words text-sm font-medium">{v || '—'}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-slate-400">
            Created {formatDateTime(agent.created_at)} · Updated {formatDateTime(agent.updated_at)}
            {agent.published_at ? ` · Published ${formatDateTime(agent.published_at)}` : ''}
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Recent test runs (simulated)</h2>
            <Link href="/history" className="text-sm font-semibold text-violet-700">All history →</Link>
          </div>
          {historyUnavailable ? (
            <p className="mt-5 text-sm text-slate-500">History data is unavailable.</p>
          ) : runs.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">No runs yet. Publish this agent and run a test to create history.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {runs.slice(0, 5).map((r) => (
                <div key={r.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Test run #{r.id}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDateTime(r.created_at)}</p>
                      <p className="mt-1 text-sm">{r.result?.message || r.error_message}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Status status={r.status} />
                      <button type="button" aria-expanded={openRun === r.id} onClick={() => setOpenRun(openRun === r.id ? null : r.id)} className="text-sm font-semibold text-violet-700">
                        {openRun === r.id ? 'Hide details' : 'View details'}
                      </button>
                    </div>
                  </div>
                  {openRun === r.id && <div className="mt-4 border-t border-slate-200 pt-4"><RunDetails run={r} /></div>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
