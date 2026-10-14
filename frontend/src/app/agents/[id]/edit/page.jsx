'use client';
// Edit an existing DRAFT. Published/disabled agents are read-only (backend returns 409).
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import AgentForm from '../../../../components/AgentForm';
import { getAgent } from '../../../../services/agentApi';

export default function EditAgentPage() {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback((userInitiated = false) => {
    setAgent(null);
    setError('');
    let cancelled = false;
    getAgent(id, { userInitiated })
      .then((a) => { if (!cancelled) setAgent(a); })
      .catch((e) => { if (!cancelled && userInitiated) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => load(), [load]);

  if (error) {
    return (
      <>
        <Link href="/agent-center" className="text-sm text-violet-700">← Agent Center</Link>
        <div role="alert" className="mt-6 rounded-lg bg-rose-50 p-3 text-sm text-rose-700"><p>{error}</p><button type="button" onClick={() => load(true)} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white">Try again</button></div>
      </>
    );
  }
  if (!agent) return <p className="text-sm text-slate-500">Agent details are unavailable. <button type="button" onClick={() => load(true)} className="font-semibold text-violet-700 underline">Retry</button></p>;
  if (agent.status !== 'draft') {
    return (
      <>
        <Link href={`/agents/${agent.id}`} className="text-sm text-violet-700">← Back to agent</Link>
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Only draft agents can be edited. This agent is {agent.status}.</p>
      </>
    );
  }
  return <AgentForm agent={agent} />;
}
