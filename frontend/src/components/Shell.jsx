'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Shell({ children }) {
  const path = usePathname();
  const rail = [['⌂', 'Home', '/agent-center'], ['♙', 'Leads'], ['♧', 'Client'], ['⚑', 'Services'], ['▣', 'Task', '/agents/new?module=Task'], ['▤', 'Invoice'], ['◈', 'DSC', '/agents/new?module=DSC'], ['▥', 'License', '/agents/new?module=License'], ['♙', 'Password'], ['◫', 'Documents'], ['♧', 'Team'], ['▧', 'Reports'], ['♙', 'Visitors'], ['◷', 'History', '/history']];
  return <div className="turia-app min-h-screen">
    <header className="turia-topbar">
      <div className="turia-brand"><span className="turia-brand-mark">▦</span><span>Turia Associate...</span><span className="text-xs">⌄</span></div>
      <nav className="turia-product-nav" aria-label="Products">{['Notices', 'Compliance', 'WhatsApp', 'Email', 'Agents', 'Chat', 'Sprints', 'Action-Center', 'Calendar', 'To-Do'].map((item) => {
        const href = item === 'Agents' ? '/agent-center' : item === 'Action-Center' ? '/history' : null;
        const className = item === 'Agents' && path.startsWith('/agent') ? 'active' : item === 'Action-Center' && path === '/history' ? 'active' : '';
        return href ? <Link key={item} href={href} className={className}>{item}</Link> : <span key={item}>{item}{(item === 'WhatsApp' || item === 'Chat') && <b>{item === 'WhatsApp' ? 2 : 8}</b>}</span>;
      })}</nav>
      <div className="turia-top-actions"><span className="turia-timer">◷ 00:14:50</span><span className="turia-search">⌕&nbsp; Search&nbsp;⌘K</span><span>◔</span><span className="turia-avatar">LI</span></div>
    </header>
    <aside className="turia-rail">{rail.map(([icon, label, href]) => {
      const active = href && (href === '/history' ? path === href : path.startsWith(href.split('?')[0]));
      const content = <><i>{icon}</i><small>{label}</small></>;
      return href ? <Link key={label} href={href} className={active ? 'rail-active' : ''}>{content}</Link> : <span key={label}>{content}</span>;
    })}</aside>
    <main className="turia-main">{children}</main>
  </div>;
}

export function Status({ status }) {
  const styles = { draft: 'bg-amber-50 text-amber-700', published: 'bg-emerald-50 text-emerald-700', disabled: 'bg-slate-100 text-slate-600', success: 'bg-emerald-50 text-emerald-700', failed: 'bg-rose-50 text-rose-700' };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-600'}`}>{status?.replace(/^./, (c) => c.toUpperCase())}</span>;
}
