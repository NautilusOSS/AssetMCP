/**
 * Get ARC200 xUSD (app 3346881192) balance for shelly-main via AssetMCP.
 * Run from repo root: node examples/arc200-xusd-balance.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHELLY_MAIN = "6TLMFPO53BADTZCT5E6OACBGPQMXMOYRLQ62IRCM6IKAYG5V33462TV57E";
const ARC200_XUSD_APP_ID = 3346881192;

const transport = new StdioClientTransport({
  command: "node",
  args: [path.join(root, "index.js")],
  cwd: root,
});
const client = new Client({ name: "asset-mcp", version: "0.0.1" });
await client.connect(transport);

const metaRes = await client.callTool({
  name: "arc200_get_metadata",
  arguments: { network: "algorand-mainnet", appId: ARC200_XUSD_APP_ID },
});
const balanceRes = await client.callTool({
  name: "arc200_balance_of",
  arguments: {
    network: "algorand-mainnet",
    appId: ARC200_XUSD_APP_ID,
    address: SHELLY_MAIN,
  },
});

const metaText = metaRes.content?.find((c) => c.type === "text")?.text;
const balanceText = balanceRes.content?.find((c) => c.type === "text")?.text;
const meta = metaText ? JSON.parse(metaText) : null;
const balanceData = balanceText ? JSON.parse(balanceText) : null;

const decimals = meta?.data?.decimals ? Number(meta.data.decimals) : 6;
const rawBalance = balanceData?.data ?? balanceData?.returnValue ?? "0";
const human = Number(rawBalance) / 10 ** decimals;

console.log("ARC200 xUSD (app", ARC200_XUSD_APP_ID + ")");
console.log("shelly-main:", SHELLY_MAIN);
console.log("Balance (base units):", rawBalance);
console.log("Balance (human, " + decimals + " decimals):", human);
console.log(JSON.stringify({ meta: meta?.data, balance: rawBalance, human }, null, 2));

await client.close();
