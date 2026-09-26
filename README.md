# Graphite Tracker

Graphite Tracker is a self-hosted tracker for movies, television, anime, manga, manhwa and games.

## Features

- **Accounts:** registration with email verification and resendable links, sign-in with rotating
  refresh sessions, and password reset by email.
- **Catalogue:** per-category Discover pages with recent and popular views, a search field beside
  the page heading, and genre, year (1950 onwards), status and sort filters; a home search that
  covers every category at once on `/search`; games are search only, on `/games`. Pasting a TMDB,
  MangaDex, IGDB or RAWG link into the home, search, Discover or games search opens that title.
  Title pages show cast and crew for the category (directors, writers, composers, studios,
  networks and cast for films and series; staff and voice cast for anime; authors and artists for
  manga and manhwa; developers and publishers for games) and up to three trailer links. The source
  credit and View on links for every attached source sit in the page footer.
- **Adult content:** adult titles are filtered out of search, discovery, title pages, imports and
  pasted links by default, using each source's own labels plus keyword checks on titles, synopses
  and tags. A reader can allow them in settings after confirming; they are then marked 18+ and
  their artwork stays blurred unless the blur option is turned off. The system manager can turn
  adult content off for the whole site, which overrides every reader's choice.
- **Library:** planned, in progress, completed and dropped lists with per-category progress
  (seasons and episodes, chapters and volumes, or hours, completion and platforms), searchable and
  paginated. Any entry can be hidden from the reader's profile.
- **Imports:** Mihon and AniYomi backups (`.tachibk` or `.proto.gz`, up to 50 MiB) on `/import`.
  MangaDex entries match exactly; other titles get suggested matches to accept or skip. Applying
  either adds missing titles only or also raises lower progress on existing entries, and other
  reader sources are kept as inactive source references on the entry. Import previews are kept
  for seven days.
- **Ratings and reviews:** once a title is completed or dropped, rate it from 1 to 10 and write a
  public or private review with an optional title and a spoiler warning. Ratings feed each title's
  average, and signed-in readers can report public reviews.
- **Profiles:** `/users/<handle>` is private by default. Settings make the profile public and choose
  which of its statistics, library, activity, ratings and reviews sections are shown. Entries
  hidden from the profile stay out of every section and count for everyone but administrators.
- **Release notifications:** a per-title switch, offered while a title is still coming out (series
  until they end, manga until they are completed, films until 90 days after release, games while
  a release is still ahead). New episodes, chapters and releases land in the notification center
  (the bell in the header and `/notifications`) and pop up while the reader is browsing.
- **Release emails:** optional digests of the same releases, with a master switch, per-category
  switches, and daily or Monday-weekly delivery after 08:00 in the reader's time zone. Every
  digest carries signed one-click unsubscribe links, and three permanently refused deliveries
  suspend the digests.
- **Settings:** a Settings tab on the reader's own profile: profile, privacy and adult-content
  options on `/users/<handle>/settings`; email change with reverification, password change, time
  zone, JSON data export and account deletion on `.../settings/account`; release emails on
  `.../settings/notifications`; enabled sources and global or per-category source preferences on
  `.../settings/sources`. The short `/settings/...` addresses, also used in emails, redirect there.
- **Moderation:** administrators use `/admin` to resolve reports by dismissing them or hiding the
  review, hide and restore public reviews, deactivate members, which also signs them out, and list
  release emails that failed to send. Administrators and the system manager cannot be deactivated
  there. A hidden review stays hidden when its author edits it, and its author cannot delete it.
  See [Roles](#roles).
- **Layout:** designed for phones as well as desktops, with a bottom tab bar on phones, app-styled
  form messages and confirmations, and skeleton placeholders while content loads.
- Privacy, terms and credits pages.

## Stack

- React 19, Vite and Tailwind CSS 4
- NestJS 12 and TypeScript
- Prisma with PostgreSQL
- Redis
- Docker Compose

The production build serves the React application and REST API from one Node image. PostgreSQL and
Redis remain separate services.

## Local development

Requirements:

- Docker Desktop or Docker Engine with Compose
- A TMDB API Read Access Token
- Optional, for games: IGDB client credentials (`IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`), or a RAWG
  API key (`RAWG_API_KEY`) with `GAME_SOURCE=rawg`
- Optional: `DISABLED_SOURCES`, a comma-separated list of source keys (`tmdb`, `mangadex`, `igdb`,
  `rawg`) to switch off

Copy the example environment file and set `TMDB_READ_ACCESS_TOKEN`:

```sh
cp .env.example .env
```

Start the stack. The server applies the committed database migrations before it starts:

```sh
docker compose up -d --build --renew-anon-volumes --remove-orphans
```

Open:

- Application: http://localhost:4004
- API: http://localhost:4002/api/v1
- Health: http://localhost:4002/api/v1/health
- Readiness: http://localhost:4002/api/v1/ready
- Mail: http://localhost:4025

The development override delivers every email to Mailpit, where verification, password-reset and
digest messages can be opened. Replace the default local authentication secret before using the
application outside a local machine.

## Roles

| Role | Can |
| :--- | :--- |
| Member | Everything a reader does |
| Administrator | Moderate reports and reviews, deactivate members, see private profiles, reviews and hidden entries, and see failed release emails on `/admin` |
| System manager | Everything an administrator can, plus appoint and remove administrators and turn adult content off for the whole site |

There is at most one system manager.

### Appoint the system manager

The system manager can only be appointed from a shell inside the running `server` container, so
only someone with access to the server can do it. No page or API request can grant or remove the
role. The account must already be registered, verified and active; locally, open the verification
link from Mailpit first.

```sh
docker compose exec server npm run system-manager:grant --workspace server -- you@example.com
```

The command matches the email address case-insensitively, runs in one serializable transaction,
prints `<handle> is now the system manager` and signs that account out of every session. Sign in
again to see the Admin link in the account menu and the Site tab on `/admin`.

To hand the role to someone else, add `--transfer`. The previous system manager becomes a member
and can be made an administrator again afterwards:

```sh
docker compose exec server npm run system-manager:grant --workspace server -- next@example.com --transfer
```

| Message | Meaning |
| :--- | :--- |
| `No account uses that email address` | The account is not registered, or the address differs |
| `The account must be verified and active` | The verification link has not been opened, or the account is deactivated |
| `<handle> is already the system manager` | Nothing to do |
| `<handle> is the system manager; add --transfer to hand the role over` | Another account holds the role |

In production, run the same command with `docker exec` on the server container; the
[deployment runbook](https://github.com/Project-Graphite/docs/blob/main/operations/deploying-graphite-tracker.md)
has the exact steps.

### Appoint administrators

Signed in as the system manager, open `/admin` → **Users**, then **Make administrator** or
**Remove administrator** next to an account, and confirm with your own password. Only verified,
active accounts can be appointed, and the change takes effect on their next request.

### Turn adult content off for everyone

Signed in as the system manager, open `/admin` → **Site**, switch off **Allow adult content** and
confirm with your password. Readers keep their own setting, which applies again if adult content is
allowed later.

## Checks

Run checks from the application workspace:

```sh
cd app
npm ci
npm run lint
npm test
npm run build
```

`npm test` runs the server and frontend tests.

GitHub Actions run lint, tests, application builds and secret scanning. A push to `main` also
publishes `ghcr.io/project-graphite/graphite-tracker/app` tagged `sha-<short commit>` and `latest`,
then triggers the Coolify deployment.

## Deployment

Production runs at https://graphite-tracker.project-graphite.com through Coolify on the shared
Project Graphite VPS, and sends email through Gmail SMTP. Every start applies pending migrations,
so review Prisma migrations before merging to `main`.

Setup, environment variables, email, the system manager grant and rollback are in the
[deployment runbook](https://github.com/Project-Graphite/docs/blob/main/operations/deploying-graphite-tracker.md).

## Repository layout

| Path | Purpose |
| :--- | :--- |
| `app/frontend/` | React browser application |
| `app/server/` | NestJS API, Prisma schema and migrations |
| `app/Dockerfile` | Development and production image targets |
| `compose.yaml` | Shared local service definitions |
| `compose.override.yaml` | Local hot-reload services, ports and Mailpit |
| `compose.production.yaml` | Coolify production topology |

## Data sources

Movie, television and anime metadata and artwork are provided by
[The Movie Database (TMDB)](https://www.themoviedb.org/); manga and manhwa data by
[MangaDex](https://mangadex.org/); game data by [IGDB](https://www.igdb.com/) or
[RAWG](https://rawg.io/). This product uses the TMDB API but is not endorsed or certified by TMDB.
Graphite Tracker does not stream or redistribute media.

## License

[MIT](LICENSE)
