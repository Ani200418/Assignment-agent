'use client';

import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';

export function AppLayout({ children }) {
  return (
    <div className="turia-app min-h-screen">
      <AppHeader />
      <AppSidebar />
      <main className="turia-main">{children}</main>
    </div>
  );
}
