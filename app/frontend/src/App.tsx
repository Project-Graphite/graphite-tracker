import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Shell } from './components/Shell';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { VerifyPage } from './pages/VerifyPage';

function ProtectedLibrary() {
  const auth = useAuth();
  if (!auth.ready) {
    return <p className="text-muted">Loading your session…</p>;
  }
  return auth.user ? <LibraryPage /> : <Navigate replace to="/login" />;
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="discover/movies/search" element={<DiscoverPage section="search" />} />
        <Route path="discover/movies/recent" element={<DiscoverPage section="recent" />} />
        <Route path="discover/movies/popular" element={<DiscoverPage section="popular" />} />
        <Route path="discover" element={<Navigate replace to="/discover/movies/recent" />} />
        <Route path="discover/movies" element={<Navigate replace to="/discover/movies/recent" />} />
        <Route path="search" element={<Navigate replace to="/discover/movies/search" />} />
        <Route path="library" element={<ProtectedLibrary />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}
