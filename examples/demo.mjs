/**
 * Spawns asset-mcp over stdio and exercises ASA, ARC-200, and ARC-72 read tools.
 * Run from repo root: node examples/demo.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function printToolResult(label, result) {
  const text = result.content?.find((c) => c.type === "text")?.text;
  console.log(`\n--- ${label} ---`);
  if (text) {
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2));
    } catch {
      console.log(text);
    }
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(root, "index.js")],
  cwd: root,
});

const client = new Client({ name: "asset-mcp-demo", version: "0.0.1" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log(`Connected to asset-mcp — ${tools.length} tools registered.`);

printToolResult(
  "asa_get_asset (Algorand USDC)",
  await client.callTool({
    name: "asa_get_asset",
    arguments: { network: "algorand-mainnet", assetId: 31566704 },
  })
);

printToolResult(
  "arc200_get_metadata (Voi wVOI, app 390001)",
  await client.callTool({
    name: "arc200_get_metadata",
    arguments: { network: "voi-mainnet", appId: 390001 },
  })
);

printToolResult(
  "arc72_total_supply (enVoi .voi collection)",
  await client.callTool({
    name: "arc72_total_supply",
    arguments: { network: "voi-mainnet", appId: 48751784 },
  })
);

// shelly-main wallet (from UluWalletMCP)
const SHELLY_MAIN = "6TLMFPO53BADTZCT5E6OACBGPQMXMOYRLQ62IRCM6IKAYG5V33462TV57E";

// FINITE (DeFi-nite) on Algorand — ASA 400593267
printToolResult(
  "asa_get_asset (Algorand FINITE / DeFi-nite)",
  await client.callTool({
    name: "asa_get_asset",
    arguments: { network: "algorand-mainnet", assetId: 400593267 },
  })
);
printToolResult(
  "asa_get_holding (FINITE balance for shelly-main)",
  await client.callTool({
    name: "asa_get_holding",
    arguments: {
      network: "algorand-mainnet",
      address: SHELLY_MAIN,
      assetId: 400593267,
    },
  })
);

// All ASA balances for shelly-main
printToolResult(
  "asa_search_holdings (shelly-main — all ASA balances)",
  await client.callTool({
    name: "asa_search_holdings",
    arguments: {
      network: "algorand-mainnet",
      address: SHELLY_MAIN,
      limit: 50,
    },
  })
);

await client.close();
console.log("\nDone.");
