import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  AppShell,
  errorMessage,
  OutageGate,
  Skeleton,
  SnackbarProvider,
  type ShellNavItem,
  type ShellTab,
} from '@project-graphite/ui';
import { onOutage } from '../api';
import { useAuth } from '../auth';
import { FooterSourceProvider, useCurrentFooterSource } from '../footerSource';
import { InboxProvider } from '../inbox';
import { AccountMenu } from './AccountMenu';
import { Attribution } from './Attribution';
import { NotificationBell } from './NotificationBell';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `nav-link whitespace-nowrap no-underline ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`;

function within(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

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

function ScrollToTop() {
  const { pathname, search } = useLocation();
  const page = new URLSearchParams(search).get('page');
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, page]);
  return null;
}

function GraphiteMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-[1.15em] w-[0.9em] shrink-0"
      viewBox="-3 -3 36 46"
      fill="none"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.62 25 L0 40 M24.38 25 L30 40" />
      <path d="M15 0 L8.25 18 H21.75 Z" fill="currentColor" />
    </svg>
  );
}

export function Shell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [error, setError] = useState('');
  const profile = auth.user ? `/users/${auth.user.handle}` : null;

  async function signOut() {
    setError('');
    try {
      await auth.logout();
      navigate('/');
    } catch (reason) {
      setError(errorMessage(reason, 'Could not sign out'));
    }
  }

  const nav: ShellNavItem[] = [
    { href: '/discover/movie/recent', label: 'discover', active: within(pathname, '/discover/movie/recent') },
    { href: '/games', label: 'games', active: within(pathname, '/games') },
    ...(auth.user ? [{ href: '/library', label: 'library', active: within(pathname, '/library') }] : []),
  ];

  const tabs: ShellTab[] = [
    { href: '/', label: 'Home', icon: 'home', active: pathname === '/' || pathname === '/search' },
    {
      href: '/discover/movie/recent',
      label: 'Discover',
      icon: 'compass',
      active: pathname.startsWith('/discover') || pathname.startsWith('/titles'),
    },
    { href: '/games', label: 'Games', icon: 'gamepad', active: pathname.startsWith('/games') },
    {
      href: '/library',
      label: 'Library',
      icon: 'library',
      active: pathname.startsWith('/library') || pathname.startsWith('/import'),
    },
    profile
      ? { href: profile, label: 'Profile', icon: 'user', active: pathname.startsWith(profile), loading: !auth.ready }
      : { href: '/login', label: 'Sign in', icon: 'user', active: pathname === '/login', loading: !auth.ready },
  ];

  return (
    <SnackbarProvider>
      <InboxProvider>
        <FooterSourceProvider>
          <ScrollToTop />
          <AppShell
            actions={
              !auth.ready ? (
                <span aria-hidden="true" className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                </span>
              ) : auth.user ? (
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
              )
            }
            alert={
              error && (
                <p className="shell error-message mb-3" role="alert">
                  {error}
                </p>
              )
            }
            brand={{ href: '/', mark: <GraphiteMark />, name: 'Graphite Tracker' }}
            footer={<SiteFooter />}
            nav={nav}
            tabs={tabs}
          >
            <OutageGate
              healthUrl="/api/v1/health"
              offlineHint="Reconnect to the internet to keep tracking."
              productName="Graphite Tracker"
              subscribe={onOutage}
            >
              <Outlet />
            </OutageGate>
          </AppShell>
        </FooterSourceProvider>
      </InboxProvider>
    </SnackbarProvider>
  );
}
