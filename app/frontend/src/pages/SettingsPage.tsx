import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { useResource } from '../useResource';

export interface Me {
  handle: string;
  email: string;
  displayName: string;
  bio: string | null;
  timeZone: string;
  privacy: Record<PrivacySetting, boolean>;
}

type PrivacySetting =
  | 'isPublic'
  | 'showLibrary'
  | 'showActivity'
  | 'showRatings'
  | 'showReviews'
  | 'showStatistics';

const sections: Array<[Exclude<PrivacySetting, 'isPublic'>, string, string]> = [
  ['showStatistics', 'Statistics', 'Totals for each list and category.'],
  ['showLibrary', 'Library', 'Every title with its list and progress.'],
  ['showActivity', 'Activity', 'Recent additions, list changes, ratings and reviews from the sections you show.'],
  ['showRatings', 'Ratings', 'Your scores, including in the library and statistics.'],
  ['showReviews', 'Reviews', 'Your public reviews. New reviews start public when this is on.'],
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap no-underline ${
    isActive ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
  }`;

export function SettingsLayout() {
  return (
    <div className="page-enter">
      <p className="eyebrow">Your account</p>
      <h1 className="page-title">Settings</h1>
      <nav aria-label="Settings" className="mt-7 flex gap-2 overflow-x-auto border-b border-line">
        <NavLink className={tabClass} end to="/settings">
          Profile and privacy
        </NavLink>
        <NavLink className={tabClass} to="/settings/account">
          Account
        </NavLink>
        <NavLink className={tabClass} to="/settings/notifications">
          Notifications
        </NavLink>
        <NavLink className={tabClass} to="/settings/sources">
          Sources
        </NavLink>
      </nav>
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  );
}

export function ProfileSettingsPage() {
  const auth = useAuth();
  const me = useResource<Me>('/me', true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function send(path: string, body: object) {
    setError('');
    setSaved(false);
    try {
      const next = await auth.request<Me>(path, { method: 'PATCH', body: JSON.stringify(body) });
      me.mutate(() => next);
      return true;
    } catch (reason) {
      setError(errorMessage(reason, 'Could not save your settings'));
      return false;
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaved(
      await send('/me', {
        displayName: String(form.get('displayName')),
        bio: String(form.get('bio')),
      }),
    );
  }

  if (me.error) return <p className="error-message">{me.error}</p>;
  if (!me.data) return <p className="text-muted">Loading settings…</p>;
  const { data } = me;

  return (
    <div className="grid max-w-3xl gap-12">
      {error && <p className="error-message m-0">{error}</p>}
      <section>
        <h2 className="m-0 text-xl font-medium">Profile</h2>
        <form className="mt-5 grid gap-5" key={data.displayName + data.bio} onSubmit={(event) => void saveProfile(event)}>
          <label className="field-label">
            Display name
            <input defaultValue={data.displayName} maxLength={80} name="displayName" required />
          </label>
          <label className="field-label">
            Short bio
            <textarea defaultValue={data.bio ?? ''} maxLength={500} name="bio" rows={3} />
          </label>
          <p className="mono-sm m-0 text-faint">
            Handle @{data.handle} · {data.email} · the handle is permanent so profile links keep working
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button className="primary-button" type="submit">
              Save profile
            </button>
            {saved && <span className="mono-sm text-faint">Saved.</span>}
            <Link className="rule-link mono-sm" to={`/users/${data.handle}`}>
              View your public profile
            </Link>
          </div>
        </form>
      </section>
      <section>
        <h2 className="m-0 text-xl font-medium">Privacy</h2>
        <p className="mt-2 text-sm text-muted">
          Profiles are private until you publish them. A private profile shows only your display
          name, and a hidden section shows neither its entries nor their counts. Public reviews stay
          visible on each title either way.
        </p>
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <input
            checked={data.privacy.isPublic}
            className="mt-1"
            onChange={(event) => void send('/me/privacy', { isPublic: event.target.checked })}
            type="checkbox"
          />
          <span>
            <span className="block font-medium">Public profile</span>
            <span className="text-sm text-muted">Anyone with your profile link can see the sections below.</span>
          </span>
        </label>
        <fieldset className="m-0 mt-4 grid gap-3 border-0 p-0" disabled={!data.privacy.isPublic}>
          <legend className="sr-only">Visible sections</legend>
          {sections.map(([key, label, description]) => (
            <label className={`flex items-start gap-3 ${data.privacy.isPublic ? '' : 'opacity-55'}`} key={key}>
              <input
                checked={data.privacy[key]}
                className="mt-1"
                onChange={(event) => void send('/me/privacy', { [key]: event.target.checked })}
                type="checkbox"
              />
              <span>
                <span className="block text-sm text-ink">{label}</span>
                <span className="text-sm text-muted">{description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>
    </div>
  );
}
