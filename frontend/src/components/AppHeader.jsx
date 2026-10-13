'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { headerNavigation } from '../config/navigation';

export function AppHeader() {
  const path = usePathname();

  return (
    <header className="turia-topbar">
      <div className="turia-brand">
        <span className="turia-brand-mark">▦</span>
        <span>Turia Associate...</span>
        <span className="text-xs">⌄</span>
      </div>
      <nav className="turia-product-nav" aria-label="Products">
        {headerNavigation.map(({ label, route, activePrefix, badge }) => {
          const active = activePrefix ? path.startsWith(activePrefix) : route && path === route;
          const content = <>{label}{badge && <b>{badge}</b>}</>;
          return route
            ? <Link key={label} href={route} className={active ? 'active' : ''}>{content}</Link>
            : <span key={label}>{content}</span>;
        })}
      </nav>
      <div className="turia-top-actions">
        <span className="turia-timer">◷ 00:14:50</span>
        <span className="turia-search">⌕&nbsp; Search&nbsp;⌘K</span>
        <span aria-hidden="true">◔</span>
        <span className="turia-avatar">LI</span>
      </div>
    </header>
  );
}
