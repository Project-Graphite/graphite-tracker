import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { errorMessage } from '../api';
import { useAuth } from '../auth';
import { Dialog } from '../components/Dialog';
import { FormSkeleton, LinesSkeleton } from '../components/Skeleton';
import { Toggle } from '../components/Toggle';
import { useSiteSettings } from '../site';
import { useResource } from '../useResource';

export interface Me {
  handle: string;
  email: string;
  displayName: string;
  bio: string | null;
  timeZone: string;
  showAdultContent: boolean;
  blurAdultContent: boolean;
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


export function SettingsLayout() {
  return (
    <div className="page-enter">
      <p className="eyebrow">Your account</p>
      <h1 className="page-title">Settings</h1>
      <nav aria-label="Settings" className="mt-7 flex gap-2 overflow-x-auto border-b border-line">
        <NavLink className="tab-link" end to="/settings">
          Profile and privacy
        </NavLink>
        <NavLink className="tab-link" to="/settings/account">
          Account
        </NavLink>
        <NavLink className="tab-link" to="/settings/notifications">
          Notifications
        </NavLink>
        <NavLink className="tab-link" to="/settings/sources">
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
  const site = useSiteSettings();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [confirmingAdult, setConfirmingAdult] = useState(false);

  async function send(path: string, body: object) {
    setError('');
    setSaved(false);
    try {
      const next = await auth.request<Me>(path, { method: 'PATCH', body: JSON.stringify(body) });
      me.mutate(() => next);
      auth.updateUser({
        displayName: next.displayName,
        showAdultContent: next.showAdultContent,
        blurAdultContent: next.blurAdultContent,
      });
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
  if (!me.data) return <FormSkeleton fields={2} />;
  const { data } = me;

  return (
    <div className="fade-in grid max-w-3xl gap-12">
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
          visible on each title either way. Administrators can see private profiles and sections to
          deal with abuse.
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
      <section>
        <h2 className="m-0 text-xl font-medium">Content</h2>
        {!site.data ? (
          site.error ? (
            <p className="error-message mt-4">{site.error}</p>
          ) : (
            <LinesSkeleton className="mt-4 max-w-xl" label="Loading content settings" lines={2} />
          )
        ) : !site.data.adultContentEnabled ? (
          <p className="notice mt-4">
            Adult content is turned off on Graphite Tracker, so adult titles stay out of search,
            discovery, imports and title pages for everyone. Titles already in your library are kept.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Adult titles stay out of search, discovery, imports and title pages until you turn this
              on. Titles already in your library are kept either way.
            </p>
            <div className="mt-5 grid gap-3">
              <Toggle
                checked={data.showAdultContent}
                description="Adult films, erotica and pornographic manga, and adult-only games, as labelled by each source. Results marked 18+ come from this setting."
                label="Show adult content"
                onChange={(checked) =>
                  checked ? setConfirmingAdult(true) : void send('/me', { showAdultContent: false })
                }
              />
              <Toggle
                checked={data.blurAdultContent}
                description="Posters and backdrops of 18+ titles stay blurred until you hover over them or choose to show them."
                disabled={!data.showAdultContent}
                label="Blur adult artwork"
                onChange={(checked) => void send('/me', { blurAdultContent: checked })}
              />
            </div>
            {confirmingAdult && (
              <Dialog eyebrow="Content" onClose={() => setConfirmingAdult(false)} title="Show adult content?">
                <div className="mt-6 grid gap-4 text-sm text-muted">
                  <p className="m-0">
                    Search, discovery and title pages will include adult films, erotica and pornographic
                    manga, and adult-only games. Each one is marked 18+, and its artwork stays blurred
                    while the blur option is on.
                  </p>
                  <p className="m-0">
                    Sources label this content themselves, so the filter is best effort in both
                    directions. Turning it on confirms that you are an adult and want to see it.
                  </p>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button className="secondary-button" onClick={() => setConfirmingAdult(false)} type="button">
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setConfirmingAdult(false);
                      void send('/me', { showAdultContent: true });
                    }}
                    type="button"
                  >
                    Show adult content
                  </button>
                </div>
              </Dialog>
            )}
          </>
        )}
      </section>
    </div>
  );
}
