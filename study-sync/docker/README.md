# Study Sync Docker

## Flows
- Build a prebundled headless study-sync server image.
- Start the container with `STUDY_SYNC_*` env vars.

## Requirements
- Build context must include the Aryazos workspace directories:
  - ts-base, ts-ui, ts-views, ts-config, study, study-sync
- A workspace `pnpm-workspace.yaml` and `package.json` at the build context root.

## Usage
- Copy `docker/workspace.pnpm-workspace.yaml` and `docker/workspace.package.json`
  into the build context root as `pnpm-workspace.yaml` and `package.json`.
- Build with: `docker build -f study-sync/docker/Dockerfile .`

## Config
- Runtime env vars are `STUDY_SYNC_*` (see server infra templates).
