import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { FooterSourceProvider, useCurrentFooterSource } from '../footerSource';
import { InboxProvider } from '../inbox';
import { SnackbarProvider } from '../snackbar';
import { Attribution } from './Attribution';
import { NotificationBell } from './NotificationBell';
import { OutageGate } from './Outage';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap no-underline transition-colors ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;

function SiteFooter() {
  const source = useCurrentFooterSource();
  return (
    <footer className="shell mono-sm mt-16 border-t border-line-soft py-8 text-faint">
      {source && (
        <div className="fade-in mb-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-line-soft pb-6">
          <Attribution source={source} />
          {source.links?.map((link) => (
            <a className="rule-link" href={link.url} key={link.url} rel="noreferrer" target="_blank">
              {link.label}
            </a>
          ))}
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-3">
        <span>Track stories across every medium.</span>
        <nav aria-label="About" className="flex gap-5">
          <Link className="text-faint no-underline hover:text-ink" to="/privacy">
            privacy
          </Link>
          <Link className="text-faint no-underline hover:text-ink" to="/terms">
            terms
          </Link>
          <Link className="text-faint no-underline hover:text-ink" to="/credits">
            credits
          </Link>
        </nav>
      </div>
    </footer>
  );
}

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
    <SnackbarProvider>
      <InboxProvider>
        <FooterSourceProvider>
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
                      <NotificationBell />
                      <NavLink className={navClass} to={`/users/${auth.user.handle}`}>
                        profile
                      </NavLink>
                      <NavLink className={navClass} to="/settings">
                        settings
                      </NavLink>
                      {auth.user.role !== 'member' && (
                        <NavLink className={navClass} to="/admin">
                          admin
                        </NavLink>
                      )}
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
              <OutageGate>
                <Outlet />
              </OutageGate>
            </main>
            <SiteFooter />
          </div>
        </FooterSourceProvider>
      </InboxProvider>
    </SnackbarProvider>
  );
}
