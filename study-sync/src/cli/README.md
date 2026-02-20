# Study Sync CLI

## Flows
- Load the stored CLI session and apply cookies to the study-sync service layer.
- Query study-sync services directly (no HTTP server or base URL).
- Resolve path segments into nodes by name or id, lazy-loading children from cache/provider.
- Save files/folders to disk using `save`, creating directories as needed.
- Render output as tables or JSON depending on flags.

## Requirements
- Use shared study-sync types from `@aryazos/types/study`.
- Keep service access and path resolution in separate modules.

## Data Models
- `SyncNode`: shared node shape for API responses.
- `SyncAuthStatus`: shared auth status payload.

## Notes
- `login` uses Playwright to create a Moodle session and applies cookies directly to the study-sync service layer.
- Set `MOODLE_USERNAME` / `MOODLE_PASSWORD` for headless login or log in manually in the browser window.
- CLI reads/writes session data from `~/.aryazos/study-sync` (or `ARYAZOS_STUDY_SYNC_DATA_DIR`) and caches in `~/.aryazos/study-sync/cache`.
- `save` supports wildcards like `Course/*` to save all children.
- `save` supports `--file-format` / `--folder-format` options: `name`, `name-id`, `id`.
