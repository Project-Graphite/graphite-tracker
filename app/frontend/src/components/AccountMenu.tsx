import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth';
import { useDismiss } from '../useDismiss';

export function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, root, close);
  if (!auth.user) return null;
  const { displayName, handle, role } = auth.user;
  const items = [
    [`/users/${handle}`, 'Your profile'],
    [`/users/${handle}/settings`, 'Settings'],
    ['/notifications', 'Notifications'],
    ...(role === 'member' ? [] : [['/admin', 'Admin']]),
  ];

  return (
    <div className="relative" ref={root}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${displayName}`}
        className="avatar-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {displayName.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div aria-label="Account" className="popover-panel account-menu" role="menu">
          <div className="border-b border-line px-4 py-3">
            <p className="m-0 truncate text-sm text-ink">{displayName}</p>
            <p className="mono-sm m-0 truncate text-faint">@{handle}</p>
          </div>
          {items.map(([to, label]) => (
            <Link className="menu-item" key={to} onClick={close} role="menuitem" to={to}>
              {label}
            </Link>
          ))}
          <button
            className="menu-item border-t border-line"
            onClick={() => {
              close();
              onSignOut();
            }}
            role="menuitem"
            type="button"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
