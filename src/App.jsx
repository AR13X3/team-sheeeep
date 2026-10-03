import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { StoreProvider, useStore } from './state/store.jsx';
import Login from './screens/Login.jsx';
import { APP_NAME } from './config.js';
import LoadingScreen from './components/LoadingScreen.jsx';

// Screens after login are split into their own chunks (the map ones pull in Leaflet).
const Experience = lazy(() => import('./screens/Experience.jsx'));
const YourFarm = lazy(() => import('./screens/YourFarm.jsx'));
const OutlinePaddocks = lazy(() => import('./screens/OutlinePaddocks.jsx'));
const ReviewPaddocks = lazy(() => import('./screens/ReviewPaddocks.jsx'));
const PaddockHistory = lazy(() => import('./screens/PaddockHistory.jsx'));
const PaddockPriorities = lazy(() => import('./screens/PaddockPriorities.jsx'));
const Planner = lazy(() => import('./screens/Planner.jsx'));
const Dashboard = lazy(() => import('./screens/Dashboard.jsx'));

// Flow (from the Figma prototype + sketch):
// Login → Experience → Your farm (crops, livestock) → Outline paddocks → Soil review → [Paddock history → Priorities] × N → Planner
const TITLES = {
  '/': 'Login',
  '/experience': 'Experience',
  '/farm': 'Your farm',
  '/paddocks': 'Outline your paddocks',
  '/paddocks/review': 'New paddocks',
  '/planner': 'Planner',
  '/dashboard': 'Dashboard',
};

function RequireUser({ children }) {
  const { state } = useStore();
  return state.user ? children : <Navigate to="/" replace />;
}

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = TITLES[pathname] || (pathname.endsWith('/history') ? 'Paddock history' : pathname.endsWith('/priorities') ? 'Paddock priorities' : '');
    document.title = page ? `${page} · ${APP_NAME}` : APP_NAME;
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const guard = (el) => <RequireUser>{el}</RequireUser>;

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <DocumentTitle />
        <Suspense fallback={<LoadingScreen delay={250} />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/experience" element={guard(<Experience />)} />
            <Route path="/farm" element={guard(<YourFarm />)} />
            <Route path="/paddocks" element={guard(<OutlinePaddocks />)} />
            <Route path="/paddocks/review" element={guard(<ReviewPaddocks />)} />
            <Route path="/paddocks/:id/history" element={guard(<PaddockHistory />)} />
            <Route path="/paddocks/:id/priorities" element={guard(<PaddockPriorities />)} />
            <Route path="/planner" element={guard(<Planner />)} />
            <Route path="/dashboard" element={guard(<Dashboard />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </StoreProvider>
  );
}
