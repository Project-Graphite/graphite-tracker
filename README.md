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

---

## Setting up

Delete this section once the checklist is done.

**1. Rename the placeholder service.** Every top-level folder containing a `Dockerfile` is a
deployable service and is built and pushed automatically. There is nothing to register in CI.

```
my-project/
├── frontend/Dockerfile    -> service "frontend"
├── server/Dockerfile      -> service "server"
└── worker/Dockerfile      -> service "worker"
```

Keep code in named folders even if there is only one. Image names are
`ghcr.io/project-graphite/<repo>/<service>`, and a root-level service has nothing to call itself.

**2. Give each service its checks.** A folder with a `package.json` gets `npm ci` followed by the
`lint`, `test` and `build` scripts if they exist. A folder with a `Makefile` must provide
`install`, `lint` and `test` targets. A folder with neither is only gated by its image build.

**3. Update `compose.yaml`.** It is what you and everyone else runs locally. `compose.override.yaml`
holds the local-only parts — bind mounts, hot reload, dev ports — and Docker merges it
automatically. Neither file is used in production; the deployed compose file is generated from the
registry entry.

**4. Fill in this README.** A screenshot or a short GIF, the live link once it is deployed, the
stack, and how to run it. This is what gets read.

**5. Register the project.** Open a pull request on
[platform](https://github.com/project-graphite/platform) adding `projects/<slug>.yml`. The
[README there](https://github.com/project-graphite/platform#readme) documents the fields.

Until that entry is merged, the `Deploy` job on `main` fails on purpose with a message telling you
the entry is missing. Builds and checks still run — only the deploy step is blocked.

## Conventions

Pull request titles follow `type(scope): summary` using one of `feat fix chore refactor docs test
ci perf revert style build`. Squash merges put the title into the history of `main`, which is why
it is the title that is checked and not the branch name.
