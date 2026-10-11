'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAgents, runAgentAction, setFilters } from '../../store/agentSlice';
import { Shell, Status } from '../../components/Shell';
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
  const { items, loaded, loading, error, filters } = useSelector((s) => s.agents);
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
  const showLoadError = error && items.length === 0;
  const noticeStyle = notice?.type === 'error' ? 'border-rose-100 bg-rose-50 text-rose-800' : 'border-violet-100 bg-violet-50 text-violet-900';
  const filtersActive = module !== 'All' || status !== 'All' || search.trim() !== '';

  return (
    <Shell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-violet-700">WORKSPACE / AUTOMATION</p>
            <h1 className="text-3xl font-bold tracking-tight">Agent Center</h1>
            <p className="mt-2 text-slate-500">Configure and manage your automated workflows.</p>
          </div>
          <Link href="/agents/new" className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-800">＋ Add Agent</Link>
        </div>

        {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`mb-5 rounded-xl border p-3 text-sm ${noticeStyle}`}>{notice.text}</div>}

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {MODULES.map((m) => (
            <button key={m.name} type="button" aria-pressed={module === m.name}
              onClick={() => dispatch(setFilters({ module: module === m.name ? 'All' : m.name }))}
              className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow ${module === m.name ? 'border-violet-400 ring-2 ring-violet-100' : 'border-slate-200'}`}>
              <div className="mb-4 flex items-center justify-between">
                <span className={`grid h-11 w-11 place-items-center rounded-xl text-xl font-bold ${m.color}`}>{m.icon}</span>
                <span className="text-xs text-slate-400">{loaded ? `${counts[m.name].active} active · ${counts[m.name].total} total` : '…'}</span>
              </div>
              <h2 className="text-lg font-bold">{m.name}</h2>
              <p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{m.desc}</p>
              <div className="mt-4 text-sm font-semibold text-violet-700">{module === m.name ? 'Showing these agents ✕' : 'View agents →'}</div>
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="font-bold">Agents</h2>
              <p className="mt-1 text-sm text-slate-500">Your configured workflows</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input aria-label="Search agents by name" value={search} onChange={(e) => dispatch(setFilters({ search: e.target.value }))} placeholder="Search agents..." className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              <select aria-label="Filter by module" value={module} onChange={(e) => dispatch(setFilters({ module: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option>All</option>{MODULES.map((m) => <option key={m.name}>{m.name}</option>)}
              </select>
              <select aria-label="Filter by status" value={status} onChange={(e) => dispatch(setFilters({ status: e.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="All">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {showInitialLoading || (loading && items.length === 0 && !error) ? (
            <p className="p-10 text-center text-sm text-slate-500">Loading agents…</p>
          ) : showLoadError ? (
            <div role="alert" className="m-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
              <p className="font-semibold">Agents could not be loaded.</p>
              <p className="mt-1">{error}</p>
              <button type="button" onClick={() => dispatch(fetchAgents())} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Try again</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-xl">＋</div>
              <h3 className="font-semibold">{filtersActive && items.length > 0 ? 'No agents match these filters' : 'No agents found'}</h3>
              <p className="mt-1 text-sm text-slate-500">{filtersActive && items.length > 0 ? 'Try clearing the search or filters.' : 'Create an agent to start configuring your workflows.'}</p>
              {filtersActive && items.length > 0
                ? <button type="button" onClick={() => dispatch(setFilters({ module: 'All', status: 'All', search: '' }))} className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">Clear filters</button>
                : <Link href="/agents/new" className="mt-4 inline-block rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Create first agent</Link>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {error && <p role="alert" className="m-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>{['Agent name', 'Module', 'Status', 'Updated', 'Actions'].map((h) => <th key={h} scope="col" className="px-5 py-3">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((a) => (
                    <tr key={a.id}>
                      <td className="px-5 py-4">
                        <Link className="font-semibold text-slate-800 hover:text-violet-700" href={`/agents/${a.id}`}>{a.name}</Link>
                        <p className="mt-1 max-w-xs truncate text-xs text-slate-500">{a.description || a.config.trigger}</p>
                      </td>
                      <td className="px-5 py-4">{a.module}</td>
                      <td className="px-5 py-4"><Status status={a.status} /></td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(a.updated_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-3">
                          <Link href={`/agents/${a.id}`} aria-label={`View ${a.name}`} className="text-slate-600 hover:text-violet-700">View</Link>
                          {a.status === 'draft' && <>
                            <Link href={`/agents/${a.id}/edit`} aria-label={`Edit ${a.name}`} className="font-semibold text-slate-700 hover:text-violet-700">Edit</Link>
                            <button type="button" disabled={busyId === a.id} onClick={() => runAction(a, 'publish')} aria-label={`Publish ${a.name}`} className="font-semibold text-violet-700 disabled:opacity-50">Publish</button>
                          </>}
                          {a.status === 'published' && <>
                            <button type="button" disabled={busyId === a.id} onClick={() => runAction(a, 'test-run')} aria-label={`Run simulated test for ${a.name}`} className="font-semibold text-violet-700 disabled:opacity-50">Test run</button>
                            <button type="button" disabled={busyId === a.id} onClick={() => runAction(a, 'disable')} aria-label={`Disable ${a.name}`} className="text-slate-500 disabled:opacity-50">Disable</button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
