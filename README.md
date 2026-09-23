# Graphite Tracker

Graphite Tracker is a self-hosted tracker for movies, television, anime, manga, manhwa and games. It
includes account registration, local email verification, sign-in, per-category search with recent
and popular views (search only for games), title details, per-user source settings and persistent
library states.

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
