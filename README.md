# Graphite Tracker

Graphite Tracker is a self-hosted tracker for movies, television, anime, manga, manhwa and games.

## Features

- **Accounts:** registration with email verification and resendable links, sign-in with rotating
  refresh sessions, and password reset by email.
- **Catalogue:** per-category Discover pages with recent and popular views and genre, year, status
  and sort filters; games are search only, on `/games`; title details with links to every attached
  source. Adult titles are filtered out of lists and title details.
- **Library:** planned, in progress, completed and dropped lists with per-category progress
  (seasons and episodes, chapters and volumes, or hours, completion and platforms), searchable and
  paginated.
- **Imports:** Mihon and AniYomi backups (`.tachibk` or `.proto.gz`, up to 50 MiB) on `/import`.
  MangaDex entries match exactly; other titles get suggested matches to accept or skip. Applying
  either adds missing titles only or also raises lower progress on existing entries, and other
  reader sources are kept as inactive source references on the entry. Import previews are kept
  for seven days.
- **Ratings and reviews:** once a title is completed or dropped, rate it from 1 to 10 and write a
  public or private review with an optional title and a spoiler warning. Ratings feed each title's
  average, and signed-in readers can report public reviews.
- **Profiles:** `/users/<handle>` is private by default. Settings make the profile public and choose
  which of its statistics, library, activity, ratings and reviews sections are shown.
- **Release emails:** opt-in digests of new episodes, chapters and releases for planned and
  in-progress titles, with a master switch, per-category and per-title switches, and daily or
  Monday-weekly delivery after 08:00 in the reader's time zone. Every digest carries signed
  one-click unsubscribe links, and three permanently refused deliveries suspend the digests.
- **Settings:** profile and privacy on `/settings`; email change with reverification, password
  change, time zone, JSON data export and account deletion on `/settings/account`; release emails
  on `/settings/notifications`; enabled sources and global or per-category source preferences on
  `/settings/sources`.
- **Moderation:** the administrator's `/admin` page resolves reports by dismissing them or hiding
  the review, hides and restores public reviews, deactivates accounts, which also signs them out,
  and lists release emails that failed to send. Administrator accounts cannot be deactivated there.
  A hidden review stays hidden when its author edits it, and its author cannot delete it.
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

## Administrator

Grant administrator access once, to an account that is registered, verified and active:

```sh
docker compose exec server npm run admin:grant --workspace server -- you@example.com
```

The command matches the email address case-insensitively, prints `<handle> is now the
administrator` and refuses to run once any administrator exists. Reload the application to see the
admin page. Locally, open the verification link from Mailpit first; the production procedure is in
the deployment runbook.

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

Setup, environment variables, email, the administrator grant and rollback are in the
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
