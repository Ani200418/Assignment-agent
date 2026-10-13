// Central navigation registry. Modules can add a route when their page is merged;
// leaving route undefined keeps an item present without creating a broken link.
export const headerNavigation = [
  { label: 'Notices', icon: '◌' },
  { label: 'Compliance', icon: '◫' },
  { label: 'WhatsApp', icon: '◉', badge: 2 },
  { label: 'Email', icon: '✉' },
  { label: 'Agents', icon: '♙', route: '/agent-center', activePrefix: '/agent' },
  { label: 'Chat', icon: '◍', badge: 8 },
  { label: 'Sprints', icon: '▤' },
  { label: 'Action-Center', icon: '◷', route: '/history' },
  { label: 'Calendar', icon: '▦' },
  { label: 'To-Do', icon: '☑' },
];

export const sidebarNavigation = [
  { label: 'Home', icon: '⌂', route: '/agent-center' },
  { label: 'Leads', icon: '♙' },
  { label: 'Client', icon: '♧' },
  { label: 'Services', icon: '⚑' },
  { label: 'Task', icon: '▣', route: '/agents/new?module=Task' },
  { label: 'Invoice', icon: '▤' },
  { label: 'DSC', icon: '◈', route: '/agents/new?module=DSC' },
  { label: 'License', icon: '▥', route: '/agents/new?module=License' },
  { label: 'Password', icon: '♙' },
  { label: 'Documents', icon: '◫' },
  { label: 'Team', icon: '♧' },
  { label: 'Reports', icon: '▧' },
  { label: 'Visitors', icon: '♙' },
  { label: 'History', icon: '◷', route: '/history' },
];
