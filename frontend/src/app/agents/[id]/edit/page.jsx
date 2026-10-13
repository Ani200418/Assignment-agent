'use client';
// Edit an existing DRAFT. Published/disabled agents are read-only (backend returns 409).
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AgentForm from '../../../../components/AgentForm';
import { getAgent } from '../../../../services/agentApi';

export default function EditAgentPage() {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getAgent(id)
      .then((a) => { if (!cancelled) setAgent(a); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  if (error) {
    return (
      <>
        <Link href="/agent-center" className="text-sm text-violet-700">← Agent Center</Link>
        <p role="alert" className="mt-6 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      </>
    );
  }
  if (!agent) return <p className="text-sm text-slate-500">Loading agent…</p>;
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
