import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const DEFAULT_BASE_URL = "http://localhost:3333/api";
const baseUrl = process.env.STUDY_SYNC_MCP_BASE_URL || DEFAULT_BASE_URL;

const server = new Server(
  { name: "study-sync-mcp", version: "1.0.0" },
  { capabilities: { tools: { listChanged: true } } },
);

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function listRemoteTools() {
  const payload = await fetchJson(`${baseUrl}/mcp/tools`);
  const tools = Array.isArray(payload?.tools) ? payload.tools : [];
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: "object",
      additionalProperties: true,
    },
  }));
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = await listRemoteTools();
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments ?? {};

  const result = await fetchJson(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: toolName, args }),
  });

  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
