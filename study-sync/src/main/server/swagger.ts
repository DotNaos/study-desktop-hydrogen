export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Study Sync API",
    version: "1.0.0",
    description: "Local data provider API for Aryazos Desktop/Mobile apps",
  },
  servers: [
    { url: "http://localhost:3333", description: "Local Study Sync" },
  ],
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        tags: ["System"],
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "number", example: 1702060000000 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/status": {
      get: {
        summary: "Get authentication status",
        tags: ["Auth"],
        responses: {
          "200": {
            description: "Authentication status",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    authenticated: { type: "boolean" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/nodes": {
      get: {
        summary: "Get all root nodes",
        tags: ["Nodes"],
        responses: {
          "200": {
            description: "List of nodes",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Node" },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/nodes/{id}": {
      get: {
        summary: "Get a node by ID",
        tags: ["Nodes"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Node details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Node" },
              },
            },
          },
          "404": { description: "Node not found" },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/nodes/{id}/children": {
      get: {
        summary: "Get children of a node (lazy load)",
        tags: ["Nodes"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "List of child nodes",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Node" },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/nodes/{id}/refresh": {
      post: {
        summary: "Force refresh a node (clear cache, refetch)",
        tags: ["Nodes"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Refresh result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    nodes: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Node" },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/nodes/{id}/data": {
      get: {
        summary: "Download node data (e.g., PDF content)",
        tags: ["Nodes"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "File content",
            content: {
              "application/pdf": {},
              "application/octet-stream": {},
            },
          },
          "404": { description: "Node not found or no data" },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/nodes/{id}/materialize": {
      post: {
        summary: "Materialize a node (download and cache)",
        tags: ["Nodes"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Materialized node",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Node" },
              },
            },
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
  },
  components: {
    schemas: {
      Node: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          type: { type: "string", enum: ["folder", "file", "note", "group", "pdf"] },
          parent: { type: "string", nullable: true },
          materialized: { type: "boolean" },
          refreshable: { type: "boolean" },
          providerId: { type: "string", nullable: true },
          sourceUrl: { type: "string", nullable: true },
        },
      },
    },
  },
};
