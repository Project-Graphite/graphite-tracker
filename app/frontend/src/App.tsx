import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './auth';
import { catalogSections, discoverCategories } from './catalog';
import { Shell } from './components/Shell';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { LoginPage } from './pages/LoginPage';
import { SourcesPage } from './pages/SourcesPage';
import { TitleDetailsPage } from './pages/TitleDetailsPage';
import { RegisterPage } from './pages/RegisterPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { TrackGamesPage } from './pages/TrackGamesPage';
import { VerifyPage } from './pages/VerifyPage';

function Protected({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.ready) {
    return <p className="text-muted">Loading your session…</p>;
  }
  return auth.user ? children : <Navigate replace to="/login" />;
}

function DiscoverRoute() {
  const { category, section } = useParams();
  if (category === 'game') {
    return <Navigate replace to="/games" />;
  }
  const validCategory = discoverCategories.find((item) => item === category);
  const validSection = catalogSections.find((item) => item === section);
  return validCategory && validSection ? (
    <DiscoverPage category={validCategory} section={validSection} />
  ) : (
    <Navigate replace to="/discover/movie/recent" />
  );
}

function SignedOutLogin() {
  const auth = useAuth();
  if (!auth.ready) {
    return <p className="text-muted">Loading your session…</p>;
  }
  return auth.user ? <Navigate replace to="/" /> : <LoginPage />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="discover/:category/:section" element={<DiscoverRoute />} />
        <Route path="discover" element={<Navigate replace to="/discover/movie/recent" />} />
        <Route path="titles/:category/:externalId" element={<TitleDetailsPage />} />
        <Route path="games" element={<Protected><TrackGamesPage /></Protected>} />
        <Route path="library" element={<Protected><LibraryPage /></Protected>} />
        <Route path="sources" element={<Protected><SourcesPage /></Protected>} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="login" element={<SignedOutLogin />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
