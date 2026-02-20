# Study Sync MCP Bridge

## Flows
- Expose Study Sync `/api/mcp` tools over MCP stdio.

## Requirements
- Study Sync server must be running (default `http://localhost:3333/api`).
- Set `STUDY_SYNC_MCP_BASE_URL` to override the API base URL.

## Data Models
- Tools are read from `/api/mcp/tools` and forwarded to `/api/mcp`.
