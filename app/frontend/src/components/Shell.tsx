import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { FooterSourceProvider, useCurrentFooterSource } from '../footerSource';
import { InboxProvider } from '../inbox';
import { SnackbarProvider } from '../snackbar';
import { AccountMenu } from './AccountMenu';
import { Attribution } from './Attribution';
import { Icon, type IconName } from './Icon';
import { NotificationBell } from './NotificationBell';
import { OutageGate } from './Outage';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `nav-link whitespace-nowrap no-underline ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;

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

function MobileTabBar() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const profile = auth.user ? `/users/${auth.user.handle}` : null;
  const tabs: Array<{ to: string; label: string; icon: IconName; active: boolean }> = [
    { to: '/', label: 'Home', icon: 'home', active: pathname === '/' || pathname === '/search' },
    {
      to: '/discover/movie/recent',
      label: 'Discover',
      icon: 'compass',
      active: pathname.startsWith('/discover') || pathname.startsWith('/titles'),
    },
    { to: '/games', label: 'Games', icon: 'gamepad', active: pathname.startsWith('/games') },
    {
      to: '/library',
      label: 'Library',
      icon: 'library',
      active: pathname.startsWith('/library') || pathname.startsWith('/import'),
    },
    profile
      ? { to: profile, label: 'Profile', icon: 'user', active: pathname.startsWith(profile) }
      : { to: '/login', label: 'Sign in', icon: 'user', active: pathname === '/login' },
  ];

  return (
    <nav aria-label="Main" className="tab-bar md:hidden">
      {tabs.map((tab) => (
        <Link
          aria-current={tab.active ? 'page' : undefined}
          className="tab-bar-item"
          key={tab.label}
          to={tab.to}
        >
          <Icon name={tab.icon} size={22} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
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
          <div className="flex min-h-screen flex-col pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
            <a className="skip-link" href="#content">
              skip to content
            </a>
            <header className="sticky top-0 z-20 border-b border-line-soft bg-paper/90 backdrop-blur-md">
              <div className="shell flex h-16 items-center gap-6">
                <Link className="shrink-0 text-lg font-semibold tracking-tight text-ink no-underline" to="/">
                  Graphite Tracker
                </Link>
                <nav aria-label="Primary" className="mono-sm hidden items-center gap-6 md:flex">
                  <NavLink className={navClass} to="/discover/movie/recent">
                    discover
                  </NavLink>
                  <NavLink className={navClass} to="/games">
                    games
                  </NavLink>
                  {auth.user && (
                    <NavLink className={navClass} to="/library">
                      library
                    </NavLink>
                  )}
                </nav>
                <div className="ml-auto flex items-center gap-2">
                  {auth.user ? (
                    <>
                      <NotificationBell />
                      <AccountMenu onSignOut={() => void signOut()} />
                    </>
                  ) : (
                    <>
                      <NavLink className={(state) => `${navClass(state)} mono-sm px-2`} to="/login">
                        sign in
                      </NavLink>
                      <Link className="primary-button hidden px-3 py-2 text-sm sm:inline-flex" to="/register">
                        Create account
                      </Link>
                    </>
                  )}
                </div>
              </div>
              {error && (
                <p className="shell error-message mb-3" role="alert">
                  {error}
                </p>
              )}
            </header>
            <main className="shell flex-1 py-8 sm:py-14" id="content">
              <OutageGate>
                <Outlet />
              </OutageGate>
            </main>
            <SiteFooter />
            <MobileTabBar />
          </div>
        </FooterSourceProvider>
      </InboxProvider>
    </SnackbarProvider>
  );
}
