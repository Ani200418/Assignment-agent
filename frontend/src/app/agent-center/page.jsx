'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAgents, runAgentAction, setFilters } from '../../store/agentSlice';
import { Status } from '../../components/Shell';
import { formatDate } from '../../lib/format';

// Visual metadata for the three module cards. (Triggers/options live in the backend definitions.)
const MODULES = [
  { name: 'Task', desc: 'Task creation, assignment notifications, and reminders', icon: '✓', color: 'bg-blue-50 text-blue-700' },
  { name: 'DSC', desc: 'Digital signature certificate expiry and renewal reminders', icon: '⌁', color: 'bg-violet-50 text-violet-700' },
  { name: 'License', desc: 'License expiry reminders and renewal notifications', icon: '▣', color: 'bg-amber-50 text-amber-700' },
];
const STATUSES = ['draft', 'published', 'disabled'];

export default function AgentCenter() {
  const dispatch = useDispatch();
  const { items, loaded, loading, error, userInitiatedError, filters } = useSelector((s) => s.agents);
  const { module, status, search } = filters;
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', text }
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { dispatch(fetchAgents()); }, [dispatch]);

  // Counts come from the FULL list, so they always match the database whatever filter is selected.
  const counts = useMemo(() => {
    const result = {};
    MODULES.forEach((m) => {
      const mine = items.filter((a) => a.module === m.name);
      result[m.name] = { active: mine.filter((a) => a.status === 'published').length, total: mine.length };
    });
    return result;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) =>
      (module === 'All' || a.module === module) &&
      (status === 'All' || a.status === status) &&
      (!q || a.name.toLowerCase().includes(q)));
  }, [items, module, status, search]);

  async function runAction(agent, verb) {
    setNotice(null);
    setBusyId(agent.id);
    try {
      const result = await dispatch(runAgentAction({ id: agent.id, verb })).unwrap();
      if (verb === 'publish') setNotice({ type: 'success', text: `"${agent.name}" published.` });
      else if (verb === 'disable') setNotice({ type: 'success', text: `"${agent.name}" disabled.` });
      else if (result.status === 'failed') setNotice({ type: 'error', text: `Simulated test run FAILED for "${agent.name}": ${result.error_message}` });
      else setNotice({ type: 'success', text: `Simulated test run completed for "${agent.name}". No real notification was sent. See Agent History.` });
    } catch (e) {
      setNotice({ type: 'error', text: e.message });
    } finally {
      setBusyId(null);
    }
  }

  const showInitialLoading = !loaded && !error;
  const showLoadError = userInitiatedError && items.length === 0;
  const noticeStyle = notice?.type === 'error' ? 'border-rose-100 bg-rose-50 text-rose-800' : 'border-violet-100 bg-violet-50 text-violet-900';
  const filtersActive = module !== 'All' || status !== 'All' || search.trim() !== '';

  return (
    <>
      <div className="agent-overview">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded bg-violet-50 text-2xl text-violet-600">⚡</span><div><h1 className="font-bold tracking-tight">Agent Center</h1><p className="subtitle">Set up automated notifications for your team</p></div></div>
          </div>
          <input aria-label="Search" placeholder="⌕  Search" className="w-60 border border-slate-200 px-4 py-2.5 text-sm" />
        </div>

        {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl border p-3 text-sm ${noticeStyle}`}>{notice.text}</div>}

        <div className="agent-tabs"><span className="selected">Modules</span><Link href="/history">Trigger History</Link></div>

        <section className="module-table">
          {showInitialLoading || (loading && items.length === 0 && !error) ? (
            <p className="p-10 text-center text-sm text-slate-500">Loading agents…</p>
          ) : showLoadError ? (
            <div role="alert" className="m-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
              <p className="font-semibold">Agents could not be loaded.</p>
              <p className="mt-1">{userInitiatedError}</p>
              <button type="button" onClick={() => dispatch(fetchAgents({ userInitiated: true }))} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Try again</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead><tr>{['Module', 'Description', 'Active Task Agents', 'Action'].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MODULES.map((m) => (
                    <tr key={m.name}>
                      <td><span className="module-icon">{m.icon}</span>{m.name}</td>
                      <td>{m.desc}</td>
                      <td><span className="active-pill">{loaded ? `${counts[m.name].active} Active ${m.name} Agents` : 'Data unavailable'}</span></td>
                      <td><Link href={`/agents/new?module=${m.name}`} className="add-agent">Add Agents&nbsp; ＋</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="module-footer"><span>© 2026, Powered by <strong className="text-violet-600">TURIA</strong></span><span>{loaded ? '1-3 of 3' : 'Agent data unavailable'} &nbsp; ‹ &nbsp; ›</span></div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
