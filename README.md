# Graphite Tracker

Graphite Tracker is a self-hosted tracker for movies, television, anime, manga, manhwa and games.

## Features

- **Accounts:** registration, local email verification and sign-in with rotating refresh sessions.
- **Catalogue:** per-category Discover pages with recent and popular views and genre, year, status
  and sort filters; games are search only, on `/games`; title details with source links.
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
- **Settings:** profile and privacy on `/settings`; enabled sources and global or per-category
  source preferences on `/settings/sources`.
- **Moderation:** the administrator's `/admin` page resolves reports by dismissing them or hiding
  the review, hides and restores public reviews, and deactivates accounts, which also signs them
  out. Administrator accounts cannot be deactivated there.
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

Copy the example environment file and set `TMDB_READ_ACCESS_TOKEN`:

```sh
cp .env.example .env
```

Start the stack and apply the committed database migrations:

```sh
docker compose up -d --build --renew-anon-volumes
docker compose exec web npm run prisma:migrate:deploy
```

Open:

- Application: http://localhost:4004
- API: http://localhost:4002/api/v1
- Health: http://localhost:4002/api/v1/health
- Readiness: http://localhost:4002/api/v1/ready

The local verification-token response is enabled only by the development Compose override. Replace
the default local authentication secret before using the application outside a local machine.

## Administrator

Grant administrator access once, to an account that is registered, verified and active:

```sh
docker compose exec web npm run admin:grant --workspace backend -- you@example.com
```

The command matches the email address case-insensitively, prints `<handle> is now the
administrator` and refuses to run once any administrator exists. Reload the application to see the
admin page.

## Checks

Run checks from the application workspace:

```sh
cd app
npm ci
npm run lint
npm test
npm run build
```

GitHub Actions run lint, tests, application builds, Docker image validation and secret scanning.
They do not publish an image or deploy the application.

## Repository layout

| Path | Purpose |
| :--- | :--- |
| `app/frontend/` | React browser application |
| `app/backend/` | NestJS API, Prisma schema and migrations |
| `app/Dockerfile` | Development and production image targets |
| `compose.yaml` | Shared local service definitions |
| `compose.override.yaml` | Local hot-reload services and ports |
| `compose.production.yaml` | Future Coolify production topology |

## Data sources

Movie, television and anime metadata and artwork are provided by
[The Movie Database (TMDB)](https://www.themoviedb.org/); manga and manhwa data by
[MangaDex](https://mangadex.org/); game data by [IGDB](https://www.igdb.com/) or
[RAWG](https://rawg.io/). This product uses the TMDB API but is not endorsed or certified by TMDB.
Graphite Tracker does not stream or redistribute media.

## License

[MIT](LICENSE)
