# Project name

One sentence on what this is and who it is for.

## Stack

What it is built with, and anything unusual about how it fits together.

## Running it

```sh
docker compose up
```

Then open http://localhost:8080.

## Layout

| Folder | What it is |
| :--- | :--- |
| `web/` | Replace with the real services |

## Setting up

Delete this section once the checklist is done.

1. Rename the placeholder service. Every top-level folder containing a `Dockerfile` is a deployable
   service and is built and pushed automatically.
2. Give each service its checks. A folder with a `package.json` gets `npm ci` followed by available
   `lint`, `test`, and `build` scripts. A folder with a `Makefile` must provide `install`, `lint`, and
   `test` targets.
3. Update `compose.yaml` for local development. Put bind mounts, hot reload, and development ports
   in `compose.override.yaml`. Update `compose.production.yaml` to pull the prebuilt GHCR images,
   define health checks and persistent volumes, avoid published host ports, and cap CPU and memory.
4. Add a screenshot or short GIF, the eventual live link, the stack, and clear local instructions
   to this README.
5. Register the project by opening a pull request on
   [platform](https://github.com/project-graphite/platform) with `projects/<slug>.yml`.

Use named service folders even for a single-service project. Images are published as
`ghcr.io/project-graphite/<repo>/<service>`, and each image name must match its service in the
production Compose file.

Until the platform entry is merged, the `Deploy` job on `main` fails with a clear message. Builds
and checks continue; only the release record is blocked. Coolify deployment remains a separate,
reviewed action.

## Conventions

Pull request titles follow `type(scope): summary` using one of `feat fix chore refactor docs test ci
perf revert style build`. Squash merges put the title into the history of `main`, so the title is
checked instead of the branch name.
