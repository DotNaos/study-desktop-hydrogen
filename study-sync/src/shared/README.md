# Shared Paths

## Flows
- Resolve config and cache directories for both Electron and CLI environments.
- Prefer env overrides, then default to `~/.aryazos/study-sync` with cache in `~/.aryazos/study-sync/cache`.

## Requirements
- Avoid hard Electron dependencies so CLI can run headlessly.
- Keep filesystem path logic centralized.
- Do not migrate old appdata; start fresh in `~/.aryazos/study-sync`.

## Data Models
- Environment variables: `ARYAZOS_STUDY_SYNC_DATA_DIR`, `STUDY_SYNC_DATA_DIR`.
- Cache directory: `<dataDir>/cache`.
