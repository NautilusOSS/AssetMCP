/**
 * Build unsigned transactions to unwrap ARC200 xUSD (app 3346881192) using AssetMCP.
 * The group is [approve(appAddress), withdraw(amount)]. Sign with UluWalletMCP and broadcast.
 *
 * Run from repo root: node examples/arc200-unwrap-xusd.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHELLY_MAIN = "6TLMFPO53BADTZCT5E6OACBGPQMXMOYRLQ62IRCM6IKAYG5V33462TV57E";
const ARC200_XUSD_APP_ID = 3346881192;

// Amount in base units (6 decimals). Example: 1 xUSD = 1000000
const AMOUNT_BASE = process.env.UNWRAP_AMOUNT ?? "1000000";

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(root, "index.js")],
  cwd: root,
});
const client = new Client({ name: "asset-mcp", version: "0.0.1" });
await client.connect(transport);

const res = await client.callTool({
  name: "nt200_withdraw_txn",
  arguments: {
    network: "algorand-mainnet",
    appId: ARC200_XUSD_APP_ID,
    sender: SHELLY_MAIN,
    amount: AMOUNT_BASE,
  },
});

const text = res.content?.find((c) => c.type === "text")?.text;
const data = text ? JSON.parse(text) : res;

if (!data?.ok || !data?.data?.transactions?.length) {
  console.error("Failed to build unwrap txns:", data);
  process.exit(1);
}

console.log("ARC200 xUSD unwrap (app", ARC200_XUSD_APP_ID + ")");
console.log("Sender:", SHELLY_MAIN);
console.log("Amount (base units):", AMOUNT_BASE);
console.log("Transaction count:", data.data.transactions.length);
console.log("\nNext: sign data.data.transactions with UluWalletMCP then broadcast the group.");
console.log("Transactions (base64):", data.data.transactions.length, "txns");

await client.close();
