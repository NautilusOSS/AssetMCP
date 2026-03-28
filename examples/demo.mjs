/**
 * Spawns asset-mcp over stdio and exercises ASA, ARC-200 (including XCHG-1), and ARC-72 tools.
 * Run from repo root: node examples/demo.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// shelly-main wallet (from UluWalletMCP) — used as `sender` for txn demos
const SHELLY_MAIN = "6TLMFPO53BADTZCT5E6OACBGPQMXMOYRLQ62IRCM6IKAYG5V33462TV57E";

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

// XCHG-1 (optional ARC-200 exchange extension): read + txn builders.
// Typical ARC-200 tokens do not implement `arc200_exchange` — expect MCP error JSON until you use an XCHG-enabled app id.
const XCHG_DEMO_APP = 47138068; // WAD (Whale Asset Dollar) on Voi — illustrates not-implemented vs XCHG-enabled contracts

printToolResult(
  `arc200_exchange (Voi app ${XCHG_DEMO_APP} — XCHG read; fails if extension absent)`,
  await client.callTool({
    name: "arc200_exchange",
    arguments: { network: "voi-mainnet", appId: XCHG_DEMO_APP },
  })
);

printToolResult(
  `arc200_redeem_txn (same app — fails if arc200_exchange unavailable)`,
  await client.callTool({
    name: "arc200_redeem_txn",
    arguments: {
      network: "voi-mainnet",
      appId: XCHG_DEMO_APP,
      sender: SHELLY_MAIN,
      amount: "1000000",
    },
  })
);

printToolResult(
  `arc200_swap_back_txn (same app — fails if arc200_exchange unavailable)`,
  await client.callTool({
    name: "arc200_swap_back_txn",
    arguments: {
      network: "voi-mainnet",
      appId: XCHG_DEMO_APP,
      sender: SHELLY_MAIN,
      amount: "1000000",
    },
  })
);

printToolResult(
  "arc72_total_supply (enVoi .voi collection)",
  await client.callTool({
    name: "arc72_total_supply",
    arguments: { network: "voi-mainnet", appId: 48751784 },
  })
);

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
