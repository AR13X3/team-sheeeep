// Which sidebar section, Manami screen and breadcrumbs belong to each route.
const PADDOCK_TABS = { '': 'Overview', history: 'History', conditions: 'Conditions', priorities: 'Priorities' };

export const NAV = [
  { key: 'dashboard', label: 'Overview', icon: 'dashboard', to: '/dashboard' },
  { key: 'map', label: 'Farm map', icon: 'map', to: '/paddocks' },
  { key: 'register', label: 'Paddocks', icon: 'paddocks', to: '/register' },
  { key: 'planner', label: 'Planner', icon: 'planner', to: '/planner' },
  { key: 'insights', label: 'Insights', icon: 'insights', to: '/insights' },
];

export function routeMeta(pathname, state) {
  const simple = {
    '/dashboard': { section: 'dashboard', screen: 'dashboard', crumbs: [{ label: 'Overview' }] },
    '/paddocks': { section: 'map', screen: 'paddocks', crumbs: [{ label: 'Farm map' }] },
    '/paddocks/review': { section: 'map', screen: 'review', crumbs: [{ label: 'Farm map', to: '/paddocks' }, { label: 'Soil check' }] },
    '/register': { section: 'register', screen: 'register', crumbs: [{ label: 'Paddocks' }] },
    '/planner': { section: 'planner', screen: 'planner', crumbs: [{ label: 'Planner' }] },
    '/insights': { section: 'insights', screen: 'insights', crumbs: [{ label: 'Insights' }] },
    '/settings': { section: 'settings', screen: 'settings', crumbs: [{ label: 'Settings' }] },
    '/experience': { section: 'setup', screen: 'experience', crumbs: [{ label: 'Getting started' }, { label: 'About you' }] },
    '/farm': { section: 'setup', screen: 'farm', crumbs: [{ label: 'Getting started' }, { label: 'Your crops' }] },
  };
  if (simple[pathname]) return simple[pathname];
  const m = pathname.match(/^\/paddocks\/([^/]+)(?:\/(history|conditions|priorities))?$/);
  if (m) {
    const p = state.paddocks.find((q) => q.id === m[1]);
    const tab = m[2] || '';
    return {
      section: 'register',
      screen: tab || 'paddock',
      paddockId: p?.id,
      crumbs: [{ label: 'Paddocks', to: '/register' }, { label: p?.name || 'Paddock', to: p ? `/paddocks/${p.id}` : undefined }, { label: PADDOCK_TABS[tab] }],
    };
  }
  return { section: '', screen: '', crumbs: [] };
}

/** Browser tab title for a route. */
export function pageTitle(meta) {
  const parts = meta.crumbs.map((c) => c.label).filter(Boolean);
  return parts.slice(-2).reverse().join(' · ');
}
