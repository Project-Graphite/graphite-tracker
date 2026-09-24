import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap no-underline transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;

export function Shell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function signOut() {
    setError('');
    try {
      await auth.logout();
      navigate('/');
    } catch (reason) {
      setError(errorMessage(reason, 'Could not sign out'));
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a className="skip-link" href="#content">
        skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-line-soft bg-paper/90 backdrop-blur-md">
        <div className="shell flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <Link className="text-lg font-semibold tracking-tight text-ink no-underline" to="/">
            Graphite Tracker
          </Link>
          <nav aria-label="Primary" className="mono-sm flex flex-wrap items-center gap-x-5 gap-y-2">
            <NavLink className={navClass} to="/discover/movie/recent">
              discover
            </NavLink>
            <NavLink className={navClass} to="/games">
              games
            </NavLink>
            {auth.user ? (
              <>
                <NavLink className={navClass} to="/library">
                  library
                </NavLink>
                <NavLink className={navClass} to="/sources">
                  sources
                </NavLink>
                <button className="text-button whitespace-nowrap" onClick={() => void signOut()} type="button">
                  sign out
                </button>
              </>
            ) : (
              <NavLink className={navClass} to="/login">
                sign in
              </NavLink>
            )}
          </nav>
        </div>
        {error && (
          <p className="shell error-message mb-3" role="alert">
            {error}
          </p>
        )}
      </header>
      <main className="shell flex-1 py-10 sm:py-14" id="content">
        <Outlet />
      </main>
      <footer className="shell mono-sm mt-16 border-t border-line-soft py-8 text-faint">
        Track stories across every medium.
      </footer>
    </div>
  );
}
