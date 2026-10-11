'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export function Shell({ children }) {
 const path=usePathname();
 const links=[['/agent-center','▦','Agent Center'],['/history','◷','Agent History']];
 return <div className="min-h-screen md:flex"><aside className="w-full border-r border-slate-200 bg-white md:fixed md:inset-y-0 md:w-60"><div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6"><div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-700 font-bold text-white">T</div><div><div className="font-bold tracking-tight">turia</div><div className="text-xs text-slate-500">Agent Center</div></div></div><nav aria-label="Main" className="flex gap-2 p-3 md:block">{links.map(([href,icon,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined} className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${path===href?'bg-violet-50 text-violet-800':'text-slate-600 hover:bg-slate-50'}`}><span>{icon}</span>{label}</Link>)}</nav><div className="hidden px-6 pt-8 text-xs text-slate-400 md:block">AGENT AUTOMATION</div></aside><main className="min-w-0 flex-1 p-4 sm:p-7 md:ml-60 md:p-10">{children}</main></div>
}
export function Status({ status }) { const styles={draft:'bg-amber-50 text-amber-700',published:'bg-emerald-50 text-emerald-700',disabled:'bg-slate-100 text-slate-600',success:'bg-emerald-50 text-emerald-700',failed:'bg-rose-50 text-rose-700'}; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]||'bg-slate-100 text-slate-600'}`}>{status?.replace(/^./,c=>c.toUpperCase())}</span>; }
