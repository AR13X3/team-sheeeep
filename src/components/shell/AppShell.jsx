import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import CommandPalette from './CommandPalette.jsx';
import ManamiPanel from './ManamiPanel.jsx';
import { ShellContext } from './ShellContext.js';
import { pageTitle, routeMeta } from './routeMeta.js';
import { Skeleton } from '../ui.jsx';
import { APP_NAME } from '../../config.js';
import { SCREEN_TIPS } from '../../logic/manami.js';
import { useStore } from '../../state/store.jsx';
import { usePrefs } from '../../state/prefs.js';
import { useSpace } from '../../state/useSpace.js';
import { useSiteData } from '../../state/useSiteData.js';
import { useToast } from '../../state/toast.jsx';
import '../../styles/shell.css';

/** Fetches one paddock's soil, slope and climate in the background. */
function SiteDataLoader({ paddock, attempt }) {
  useSiteData(paddock, attempt);
  return null;
}

// Pages where background fetching waits: shapes are still changing while outlining, and the
// soil check makes its own (rate-limited) SoilGrids requests.
const QUIET = new Set(['/paddocks', '/paddocks/review']);

function PageSkeleton() {
  return (
    <div className="page" aria-busy="true">
      <div className="page__head">
        <div style={{ display: 'grid', gap: 10 }}>
          <Skeleton w={220} h={28} />
          <Skeleton w={340} h={14} />
        </div>
      </div>
      <div className="grid-3">
        <Skeleton h={110} r={14} />
        <Skeleton h={110} r={14} />
        <Skeleton h={110} r={14} />
      </div>
      <Skeleton h={320} r={14} />
    </div>
  );
}

/** Signed-in layout: sidebar, top bar, the page, plus Manami, Ctrl K search and background data. */
export default function AppShell() {
  const { state } = useStore();
  const { pathname } = useLocation();
  const prefs = usePrefs();
  const space = useSpace();
  const toast = useToast();
  const main = useRef(null);
  const meta = useMemo(() => routeMeta(pathname, state), [pathname, state]);
  const [manami, setManami] = useState({ open: false, prompt: null, key: 0 });
  const [palette, setPalette] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [siteAttempt, setSiteAttempt] = useState(0);

  useEffect(() => {
    const title = pageTitle(meta);
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    main.current?.scrollTo(0, 0);
    setMobileNav(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Read the farm from space in the background once paddocks exist (cached after the first time).
  useEffect(() => {
    if (state.paddocks.length && !QUIET.has(pathname)) space.start();
  }, [space.start, pathname, state.paddocks.length]);

  // Let the farmer know when a long satellite read finishes.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (space.running) {
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current) return;
    wasRunning.current = false;
    if (space.result) toast({ tone: 'ok', icon: 'satellite', title: 'Satellite record ready', description: `${space.result.looks} NASA images read across ${space.result.paddocks ? Object.values(space.result.paddocks)[0]?.seasons.length ?? 5 : 5} seasons.` });
    else if (space.error) toast({ tone: 'bad', title: 'Couldn’t read the satellite images', description: space.error });
  }, [space.running, space.result, space.error, toast]);

  // Ctrl/⌘ K opens search anywhere; "/" too when not typing.
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hasTip = !!SCREEN_TIPS[meta.screen] && state.experience === 'new' && !state.dismissedTips[`tip:${meta.screen}`];
  const openManami = useCallback((prompt = null) => setManami((m) => ({ open: true, prompt, key: m.key + 1 })), []);
  const closeManami = useCallback(() => setManami((m) => ({ ...m, open: false })), []);
  const ctx = useMemo(
    () => ({ meta, manamiOpen: manami.open, openManami, closeManami, openPalette: () => setPalette(true), hasTip, retrySiteData: () => setSiteAttempt((a) => a + 1) }),
    [meta, manami.open, openManami, closeManami, hasTip],
  );

  return (
    <ShellContext.Provider value={ctx}>
      <div className={`shell${prefs.sidebar === 'closed' ? ' shell--collapsed' : ''}${mobileNav ? ' shell--nav-open' : ''}${manami.open ? ' shell--manami' : ''}`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Sidebar meta={meta} />
        {mobileNav && <div className="shell__scrim" onClick={() => setMobileNav(false)} />}
        <div className="shell__main">
          <Topbar meta={meta} onMenu={() => setMobileNav(true)} />
          <main className="shell__content" id="main" ref={main} tabIndex={-1}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        {!QUIET.has(pathname) && state.paddocks.map((p) => <SiteDataLoader key={p.id} paddock={p} attempt={siteAttempt} />)}
        {manami.open && <ManamiPanel key={manami.key} screen={meta.screen} prompt={manami.prompt} onClose={closeManami} />}
        {palette && <CommandPalette onClose={() => setPalette(false)} />}
      </div>
    </ShellContext.Provider>
  );
}
