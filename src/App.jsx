import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { StoreProvider, useStore } from './state/store.jsx';
import { ToastProvider } from './state/toast.jsx';
import Login from './screens/Login.jsx';
import { APP_NAME } from './config.js';
import LoadingScreen from './components/LoadingScreen.jsx';

// Everything after sign-in lives in the app shell and is split into chunks (the map pages pull in Leaflet).
const AppShell = lazy(() => import('./components/shell/AppShell.jsx'));
const Experience = lazy(() => import('./screens/Experience.jsx'));
const YourFarm = lazy(() => import('./screens/YourFarm.jsx'));
const OutlinePaddocks = lazy(() => import('./screens/OutlinePaddocks.jsx'));
const ReviewPaddocks = lazy(() => import('./screens/ReviewPaddocks.jsx'));
const Register = lazy(() => import('./screens/Register.jsx'));
const PaddockOverview = lazy(() => import('./screens/PaddockOverview.jsx'));
const PaddockHistory = lazy(() => import('./screens/PaddockHistory.jsx'));
const PaddockConditions = lazy(() => import('./screens/PaddockConditions.jsx'));
const PaddockPriorities = lazy(() => import('./screens/PaddockPriorities.jsx'));
const Planner = lazy(() => import('./screens/Planner.jsx'));
const Dashboard = lazy(() => import('./screens/Dashboard.jsx'));
const Insights = lazy(() => import('./screens/Insights.jsx'));
const Settings = lazy(() => import('./screens/Settings.jsx'));

// Setup flow: Sign in → About you → Your crops → Farm map → Soil check → [History → Priorities] × N → Planner.
// Afterwards the sidebar reaches every page directly.

function RequireUser({ children }) {
  const { state } = useStore();
  return state.user ? children : <Navigate to="/" replace />;
}

function LoginTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === '/') document.title = `Sign in · ${APP_NAME}`;
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <HashRouter>
          <LoginTitle />
          <Suspense fallback={<LoadingScreen delay={250} />}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route
                element={
                  <RequireUser>
                    <AppShell />
                  </RequireUser>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/experience" element={<Experience />} />
                <Route path="/farm" element={<YourFarm />} />
                <Route path="/paddocks" element={<OutlinePaddocks />} />
                <Route path="/paddocks/review" element={<ReviewPaddocks />} />
                <Route path="/register" element={<Register />} />
                <Route path="/paddocks/:id" element={<PaddockOverview />} />
                <Route path="/paddocks/:id/history" element={<PaddockHistory />} />
                <Route path="/paddocks/:id/conditions" element={<PaddockConditions />} />
                <Route path="/paddocks/:id/priorities" element={<PaddockPriorities />} />
                <Route path="/planner" element={<Planner />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </ToastProvider>
    </StoreProvider>
  );
}
