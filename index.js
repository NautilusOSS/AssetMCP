/**
 * ulujs / arccjs log to console.log; MCP stdio must keep stdout JSON-RPC–clean.
 */
if (!process.env.ASSET_MCP_DEBUG) {
  const stderrLog = (...args) => console.error("[asset-mcp]", ...args);
  console.log = stderrLog;
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAssetMcpTools } from "./lib/tools.js";

const server = new McpServer({
  name: "asset-mcp",
  version: "0.1.0",
});

registerAssetMcpTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
