import { formatDateTime } from '../lib/format';

function Block({ title, value }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      {/* JSON.stringify inside <pre>: React escapes it, so nothing is rendered as HTML. */}
      <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

export function RunDetails({ run }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
        Simulated test run. No email, WhatsApp, or in-app message was actually sent.
      </p>
      {run.error_message && (
        <div role="alert" className="rounded-lg bg-rose-50 p-3 text-rose-700">
          <span className="font-semibold">Error: </span>{run.error_message}
        </div>
      )}
      <Block title="Simulated trigger event" value={run.trigger_data} />
      <Block title="Result" value={run.result} />
      <p className="text-xs text-slate-500">Run #{run.id} · {run.run_type} · {formatDateTime(run.created_at)}</p>
    </div>
  );
}
