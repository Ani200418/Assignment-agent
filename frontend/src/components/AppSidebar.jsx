'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { sidebarNavigation } from '../config/navigation';

function isActive(path, activeModule, route) {
  if (!route) return false;
  const [pathname, query] = route.split('?');
  const module = new URLSearchParams(query).get('module');
  if (path !== pathname) return false;
  return !module || activeModule === module;
}

export function AppSidebar() {
  const path = usePathname();
  const [module, setModule] = useState(null);

  useEffect(() => {
    setModule(new URLSearchParams(window.location.search).get('module'));
  }, [path]);

  return (
    <aside className="turia-rail" aria-label="Main navigation">
      {sidebarNavigation.map(({ icon, label, route }) => {
        const content = <><i>{icon}</i><small>{label}</small></>;
        return route
          ? <Link key={label} href={route} className={isActive(path, module, route) ? 'rail-active' : ''}>{content}</Link>
          : <span key={label}>{content}</span>;
      })}
    </aside>
  );
}
