'use client';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { getHistory } from '../../services/agentApi';
import { Status } from '../../components/Shell';
import { RunDetails } from '../../components/RunDetails';
import { formatDateTime } from '../../lib/format';

export default function HistoryPage() {
  const [runs, setRuns] = useState(null); // null = not loaded yet
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setError('');
    getHistory().then(setRuns).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <Link href="/agent-center" className="text-sm text-slate-500 hover:text-violet-700">← Agent Center</Link>
        <div className="mb-7 mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-violet-700">MONITORING</p>
            <h1 className="mt-2 text-3xl font-bold">Agent History</h1>
            <p className="mt-2 text-slate-500">Review agent activity and simulated execution outcomes. Nothing here was actually delivered.</p>
          </div>
          <button type="button" onClick={load} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold">Refresh</button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <div role="alert" className="m-5 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
              <p className="font-semibold">History could not be loaded.</p>
              <p className="mt-1">{error}</p>
              <button type="button" onClick={load} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Try again</button>
            </div>
          ) : runs === null ? (
            <p className="p-12 text-center text-sm text-slate-500">Loading history…</p>
          ) : runs.length === 0 ? (
            <div className="p-12 text-center">
              <h2 className="font-semibold">No history yet</h2>
              <p className="mt-2 text-sm text-slate-500">Create an agent or run a published agent to see activity here.</p>
              <Link href="/agent-center" className="mt-4 inline-block text-sm font-semibold text-violet-700">Go to Agent Center →</Link>
            </div>
          ) : (
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>{['Agent', 'Module', 'Action', 'Status', 'Time', 'Details'].map((h) => <th key={h} scope="col" className="px-5 py-4">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((r) => (
                  <Fragment key={`${r.history_type}-${r.id}`}>
                    <tr>
                      <td className="px-5 py-4 font-semibold"><Link href={`/agents/${r.agent_id}`} className="hover:text-violet-700">{r.agent_name}</Link></td>
                      <td className="px-5 py-4">{r.agent_module}</td>
                      <td className="px-5 py-4">{r.action === 'test-run' ? `Test run${r.trigger_data?.event ? `: ${r.trigger_data.event}` : ''}` : r.action}</td>
                      <td className="px-5 py-4"><Status status={r.status} /></td>
                      <td className="px-5 py-4 text-slate-500">{formatDateTime(r.created_at)}</td>
                      <td className="px-5 py-4">
                        {r.history_type === 'run' && <button type="button" aria-expanded={openId === `${r.history_type}-${r.id}`} aria-label={`${openId === `${r.history_type}-${r.id}` ? 'Hide' : 'View'} details for run ${r.id} of ${r.agent_name}`} onClick={() => setOpenId(openId === `${r.history_type}-${r.id}` ? null : `${r.history_type}-${r.id}`)} className="font-semibold text-violet-700">
                          {openId === `${r.history_type}-${r.id}` ? 'Hide' : 'View'}
                        </button>}
                      </td>
                    </tr>
                    {openId === `${r.history_type}-${r.id}` && (
                      <tr className="bg-slate-50"><td colSpan={6} className="px-5 py-4"><RunDetails run={r} /></td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
