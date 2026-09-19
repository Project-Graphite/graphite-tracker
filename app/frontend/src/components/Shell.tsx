import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

export function Shell() {
  const auth = useAuth();
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `no-underline transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;

  return (
    <div className="flex min-h-screen flex-col">
      <a className="skip-link" href="#content">
        skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-line-soft bg-paper/90 backdrop-blur-md">
        <div className="shell flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
          <Link className="text-lg font-semibold tracking-tight text-ink no-underline" to="/">
            Graphite Tracker
          </Link>
          <nav aria-label="Primary" className="mono-sm flex items-center gap-5">
            <NavLink className={navClass} to="/discover/movies/recent">
              discover
            </NavLink>
            {auth.user ? (
              <>
                <NavLink className={navClass} to="/library">
                  library
                </NavLink>
                <button className="text-button" onClick={() => void auth.logout()} type="button">
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
