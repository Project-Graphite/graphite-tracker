import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams, type Location } from 'react-router';
import { useAuth } from './auth';
import { catalogSections, discoverCategories } from './catalog';
import { Shell } from './components/Shell';
import { PageSkeleton } from './components/Skeleton';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { AdminPage } from './pages/AdminPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { HomePage } from './pages/HomePage';
import { ImportBatchPage } from './pages/ImportBatchPage';
import { ImportPage } from './pages/ImportPage';
import { CreditsPage, PrivacyPage, TermsPage } from './pages/LegalPages';
import { LibraryPage } from './pages/LibraryPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { SearchPage } from './pages/SearchPage';
import { ProfileSettingsPage, SettingsLayout } from './pages/SettingsPage';
import { SourcesPage } from './pages/SourcesPage';
import { TitleDetailsPage } from './pages/TitleDetailsPage';
import { TrackGamesPage } from './pages/TrackGamesPage';
import { UnsubscribePage } from './pages/UnsubscribePage';
import { VerifyPage } from './pages/VerifyPage';

function Protected({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.ready) {
    return <PageSkeleton label="Loading your session" />;
  }
  if (!auth.user) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }
  return admin && !auth.user.isAdmin ? <Navigate replace to="/" /> : children;
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
    <NotFoundPage />
  );
}

function SignedOutLogin() {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.ready) {
    return <PageSkeleton label="Loading your session" />;
  }
  const from = (location.state as { from?: Location } | null)?.from;
  return auth.user ? <Navigate replace to={from ?? '/'} /> : <LoginPage />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="discover/:category/:section" element={<DiscoverRoute />} />
        <Route path="discover" element={<Navigate replace to="/discover/movie/recent" />} />
        <Route path="titles/:category/:externalId" element={<TitleDetailsPage />} />
        <Route path="games" element={<TrackGamesPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="library" element={<Protected><LibraryPage /></Protected>} />
        <Route path="import" element={<Protected><ImportPage /></Protected>} />
        <Route path="import/:id" element={<Protected><ImportBatchPage /></Protected>} />
        <Route path="settings" element={<Protected><SettingsLayout /></Protected>}>
          <Route index element={<ProfileSettingsPage />} />
          <Route path="account" element={<AccountSettingsPage />} />
          <Route path="notifications" element={<NotificationSettingsPage />} />
          <Route path="sources" element={<SourcesPage />} />
        </Route>
        <Route path="admin" element={<Protected admin><AdminPage /></Protected>} />
        <Route path="users/:handle" element={<ProfilePage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="credits" element={<CreditsPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="login" element={<SignedOutLogin />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="unsubscribe" element={<UnsubscribePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
