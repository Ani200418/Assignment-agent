'use client';

export function Status({ status }) {
  const styles = { draft: 'bg-amber-50 text-amber-700', published: 'bg-emerald-50 text-emerald-700', disabled: 'bg-slate-100 text-slate-600', success: 'bg-emerald-50 text-emerald-700', failed: 'bg-rose-50 text-rose-700' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-600'}`}>{status?.replace(/^./, (c) => c.toUpperCase())}</span>;
}
