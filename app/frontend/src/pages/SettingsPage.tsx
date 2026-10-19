import Alert from '@mui/material/Alert';
import MuiLink from '@mui/material/Link';
import { useState, type FormEvent } from 'react';
import { Link, matchPath, Navigate, Outlet, useLocation, useParams } from 'react-router';
import {
  Button,
  Checkbox,
  Dialog,
  errorMessage,
  FormSkeleton,
  LinesSkeleton,
  TextAreaField,
  TextField,
  Toggle,
} from '@project-graphite/ui';
import { useAuth } from '../auth';
import { useSiteSettings } from '../site';
import { OwnerTabs } from './ProfilePage';
import { useResource } from '../useResource';
import { atMost, required, useFormErrors } from '../validation';

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
  ['showReviews', 'Reviews', 'Your public reviews.'],
];

const settingsSections = [
  ['', 'Profile and privacy'],
  ['account', 'Account'],
  ['notifications', 'Notifications'],
  ['sources', 'Sources'],
] as const;

export function SettingsLayout() {
  const auth = useAuth();
  const { handle = '' } = useParams();
  const { pathname } = useLocation();
  const user = auth.user;
  if (!user) return null;
  if (handle.toLowerCase() !== user.handle) {
    return <Navigate replace to={`/users/${handle}`} />;
  }

  return (
    <div className="page-enter">
      <p className="eyebrow">@{user.handle}</p>
      <h1 className="page-title">{user.displayName}</h1>
      <OwnerTabs handle={user.handle} />
      <nav aria-label="Settings" className="chip-row mt-6">
        {settingsSections.map(([section, label]) => {
          const href = `/users/${user.handle}/settings${section ? `/${section}` : ''}`;
          const active = Boolean(matchPath({ path: href, end: true }, pathname));
          return (
            <Button
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap ${active ? 'border-ink' : ''}`}
              href={href}
              key={section}
              size="small"
            >
              {label}
            </Button>
          );
        })}
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
  const profileForm = useFormErrors();
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
    if (
      !profileForm.check(event.currentTarget, {
        displayName: [required('Enter a display name.'), atMost(80, 'Use at most 80 characters.')],
        bio: [atMost(500, 'Keep the bio to 500 characters.')],
      })
    ) {
      return;
    }
    const form = new FormData(event.currentTarget);
    setSaved(
      await send('/me', {
        displayName: String(form.get('displayName')),
        bio: String(form.get('bio')),
      }),
    );
  }

  if (me.error) return <Alert severity="error">{me.error}</Alert>;
  if (!me.data) return <FormSkeleton fields={2} />;
  const { data } = me;

  return (
    <div className="fade-in grid max-w-3xl gap-12">
      {error && <Alert severity="error">{error}</Alert>}
      <section>
        <h2 className="m-0 text-xl font-medium">Profile</h2>
        <form
          className="mt-5 grid gap-5"
          key={data.displayName + data.bio}
          noValidate
          onSubmit={(event) => void saveProfile(event)}
        >
          <TextField defaultValue={data.displayName} label="Display name" maxLength={80} {...profileForm.field('displayName')} />
          <TextAreaField
            defaultValue={data.bio ?? ''}
            label="Short bio"
            maxLength={500}
            rows={3}
            {...profileForm.field('bio')}
          />
          <p className="mono-sm m-0 text-faint">
            Handle @{data.handle} · {data.email} · the handle is permanent so profile links keep working
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="primary">
              Save profile
            </Button>
            {saved && <span className="mono-sm text-faint">Saved.</span>}
            <MuiLink className="mono-sm" component={Link} to={`/users/${data.handle}`} underline="always">
              See your profile as others do
            </MuiLink>
          </div>
        </form>
      </section>
      <section>
        <h2 className="m-0 text-xl font-medium">Privacy</h2>
        <p className="mt-2 text-sm text-muted">
          Profiles are private until you publish them. A private profile shows only your display
          name, and a hidden section shows neither its entries nor their counts. To keep a single
          title off your profile, choose Hide from my profile in its library entry. Public reviews
          stay visible on each title either way. Administrators can see private profiles and sections to
          deal with abuse.
        </p>
        <label className="mt-5 flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
          <Checkbox
            checked={data.privacy.isPublic}
            className="mt-1"
            onChange={(event) => void send('/me/privacy', { isPublic: event.target.checked })}
          />
          <span>
            <span className="block font-medium">Public profile</span>
            <span className="text-sm text-muted">Anyone with your profile link can see the sections below.</span>
          </span>
        </label>
        <fieldset className="m-0 mt-4 grid gap-3 border-0 p-0" disabled={!data.privacy.isPublic}>
          <legend className="sr-only">Visible sections</legend>
          {sections.map(([key, label, description]) => (
            <Checkbox
              checked={data.privacy[key]}
              className={`items-start gap-3 ${data.privacy.isPublic ? '' : 'opacity-55'}`}
              key={key}
              label={
                <span>
                  <span className="block text-sm text-ink">{label}</span>
                  <span className="text-sm text-muted">{description}</span>
                </span>
              }
              onChange={(event) => void send('/me/privacy', { [key]: event.target.checked })}
            />
          ))}
        </fieldset>
      </section>
      <section>
        <h2 className="m-0 text-xl font-medium">Content</h2>
        {!site.data ? (
          site.error ? (
            <Alert className="mt-4" severity="error">{site.error}</Alert>
          ) : (
            <LinesSkeleton className="mt-4 max-w-xl" label="Loading content settings" lines={2} />
          )
        ) : !site.data.adultContentEnabled ? (
          <Alert className="mt-4" severity="info">
            Adult content is turned off on Graphite Tracker, so adult titles stay out of search,
            discovery, imports and title pages for everyone. Titles already in your library are kept.
          </Alert>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Adult titles stay out of search, discovery, imports and title pages until you turn this
              on. Titles already in your library are kept either way.
            </p>
            <div className="mt-5 grid gap-3">
              <Toggle
                checked={data.showAdultContent}
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
                  <Button onClick={() => setConfirmingAdult(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setConfirmingAdult(false);
                      void send('/me', { showAdultContent: true });
                    }}
                    variant="primary"
                  >
                    Show adult content
                  </Button>
                </div>
              </Dialog>
            )}
          </>
        )}
      </section>
    </div>
  );
}
