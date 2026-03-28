# AssetMCP

stdio [Model Context Protocol](https://modelcontextprotocol.io/) server for **UluOS**: normalized **ASA**, **ARC-200**, and **ARC-72** reads plus **unsigned** transaction payloads on **Algorand mainnet** and **Voi mainnet**.

Signing and broadcasting are intentionally out of scope—use **UluWalletMCP** and **UluBroadcastMCP** (or your wallet) after fetching base64 txn groups from this service.

## Service summary (for UluOS docs)

| Field | Value |
|--------|--------|
| **Name** | `asset-mcp` |
| **Transport** | stdio |
| **Version** | 0.1.0 |
| **Networks** | `algorand-mainnet`, `voi-mainnet` |
| **Stack** | `@modelcontextprotocol/sdk`, `algosdk` (ASA), `ulujs` → `arccjs` (ARC-200 / ARC-72 simulation) |
| **Output** | JSON text content; BigInts as strings; binary as base64; txn builders return ordered `transactions: string[]` (base64 unsigned bytes) |

## Setup

```bash
npm install
npm start
# or: node /absolute/path/to/AssetMCP/index.js
```

**Node:** >= 20.9 (required by `ulujs`).

## Configuration

Defaults use [Nodely free-tier](https://nodely.io/docs/free/start) Algod + Indexer endpoints (Algorand mainnet: `*.4160.nodely.dev`; Voi mainnet: `*.voi.nodely.dev`). No API key required. Override with environment variables:

Pattern: `ASSET_MCP_<NETWORK>_<SUFFIX>` where `<NETWORK>` is `ALGORAND_MAINNET` or `VOI_MAINNET`, and `<SUFFIX>` is one of:

- `ALGOD_URL`
- `ALGOD_TOKEN`
- `INDEXER_URL`
- `INDEXER_TOKEN`

Example:

```bash
export ASSET_MCP_ALGORAND_MAINNET_ALGOD_URL="https://..."
export ASSET_MCP_ALGORAND_MAINNET_ALGOD_TOKEN="..."
```

## Response shape

Successful tool calls return JSON:

```json
{
  "ok": true,
  "network": "algorand-mainnet",
  "standard": "asa",
  "method": "asa_get_asset",
  "assetId": 31566704,
  "data": { }
}
```

Transaction builders add `txCount` and put base64 unsigned transactions under `data.transactions` (array order is the signing order).

Errors:

```json
{
  "ok": false,
  "error": {
    "code": "malformed_address",
    "message": "...",
    "details": null
  }
}
```

## Tools (by namespace)

### `asa_*` (algosdk / AVM)

| Tool | Purpose |
|------|---------|
| `asa_get_asset` | ASA params by ID |
| `asa_get_holding` | One account’s balance / frozen flag for an ASA |
| `asa_search_holdings` | Indexer: paginated holdings; optional `assetId` filter |
| `asa_transfer_txn` | Unsigned `axfer` |
| `asa_optin_txn` | Unsigned opt-in (0-amount self transfer) |
| `asa_closeout_txn` | Unsigned transfer + `closeRemainderTo` (supply full `amount`) |

### `arc200_*` (`ulujs` ARC-200)

| Tool | Purpose |
|------|---------|
| `arc200_get_metadata` | `name`, `symbol`, `decimals`, `totalSupply` |
| `arc200_balance_of` | Balance (base units, string in JSON) |
| `arc200_allowance` | Allowance |
| `arc200_has_balance` | `hasBalance` (ulujs dual-ABI helper) |
| `arc200_has_allowance` | `hasAllowance` (ulujs dual-ABI helper) |
| `arc200_get_events` | `getEvents` → Transfer + Approval streams |
| `arc200_transfer_txn` | Simulated transfer → unsigned txn group |
| `arc200_transfer_from_txn` | Simulated `transferFrom` |
| `arc200_approve_txn` | Simulated `approve` |
| `nt200_withdraw_txn` | NT200 unwrap (underlying ASA / native) |
| `nt200_deposit_txn` | NT200 wrap (payment or `assetId` + axfer) |
| `nt200_create_balance_box_txn` | NT200 `createBalanceBox` |
| `arc200_exchange` | **XCHG-1:** read `(exchange_asset, sink)` for ASA ↔ ARC-200 exchange |
| `arc200_redeem_txn` | **XCHG-1:** ASA → app + `arc200_redeem` (receive ARC-200 from sink) |
| `arc200_swap_back_txn` | **XCHG-1:** `arc200_transfer` to sink + `arc200_swapBack` (ARC-200 → ASA) |

**XCHG-1 (optional extension)** — Draft: [ARCFoundry XCHG-1](https://github.com/NautilusOSS/ARCFoundry/blob/main/drafts/XCHG-1.md). Interface id `0xf7bde749`. Use **`arc200_exchange`** first: if it fails, the token does not expose the exchange API. Use **`arc200_transfer_txn`** (and allowances) for ordinary peer-to-peer ARC-200 moves; use **redeem / swap_back** only when moving between the paired ASA and ARC-200 via the app’s sink (e.g. POW/WAD-style positions that wrap an ASA). Redeem requires the user to hold and opt in to the **exchange ASA**; swap back requires ARC-200 balance and usually ASA opt-in to receive the outgoing ASA.

### `arc72_*` (`ulujs` ARC-72)

| Tool | Purpose |
|------|---------|
| `arc72_get_metadata` | `totalSupply`; with `tokenId`: `owner`, `tokenURI`, `approved`; optional `supportsInterface` via `interfaceSelectorHex` |
| `arc72_owner_of` | Owner |
| `arc72_balance_of` | NFT count |
| `arc72_get_approved` | Approved address for token |
| `arc72_is_approved_for_all` | Operator flag |
| `arc72_token_uri` | Token URI |
| `arc72_total_supply` | Total supply |
| `arc72_get_events` | Transfer / Approval / ApprovalForAll |
| `arc72_transfer_txn` | `transferFrom(from, to, tokenId)` (signer must be authorized) |
| `arc72_approve_txn` | Approve spender for `tokenId` |
| `arc72_set_approval_for_all_txn` | `setApprovalForAll` via **arccjs** (ulujs wrapper is broken upstream) |

## Cursor MCP config

This repo includes [`.cursor/mcp.json`](.cursor/mcp.json) so **asset-mcp** is available when you open the repo as the workspace folder. Reload the window or restart Cursor after changing it.

To add manually or merge into another project:

```json
{
  "mcpServers": {
    "asset-mcp": {
      "command": "node",
      "args": ["${workspaceFolder}/index.js"]
    }
  }
}
```

## Machine-readable capabilities

See [`examples/capabilities.json`](examples/capabilities.json).

**Live demo:** from the repo root, `npm run demo` (or `node examples/demo.mjs`) spawns the MCP server over stdio and calls `asa_get_asset` (Algorand USDC), `arc200_get_metadata` (Voi wVOI), and `arc72_total_supply` (sample ARC-72 collection).

## Implementation notes

- **stdout hygiene:** `ulujs` / `arccjs` call `console.log` during simulation. Unless `ASSET_MCP_DEBUG` is set, `console.log` is redirected to **stderr** so MCP JSON-RPC on stdout stays valid.
- **ARC txn bytes:** Built by simulating with `simulate: true` and returning the unsigned group from `arccjs` (`txns` array). Extra group transactions (e.g. box / resource-sharing) may appear—sign the full ordered group.
- **ARC-200 / ARC-72 reads:** Use ulujs `Contract` with the public simulation sender (`oneAddress` from ulujs) for readonly ABI calls.
- **Event filters:** `address` is forwarded to the indexer as **`sender`** (arccjs API).
- **ARC-72 `setApprovalForAll`:** Implemented against `contractInstance.arc72_setApprovalForAll` because `ulujs` `safe_arc72_setApprovalForAll` references undefined variables (upstream bug).
- **XCHG-1:** `arc200_redeem_txn` uses **arccjs** `setExtraTxns` with an ABI-encoded app call (axfer + redeem in one simulation). `arc200_swap_back_txn` concatenates an ulujs-simulated `arc200_transfer` to `sink` with an `arc200_swapBack` app call, then re-groups with `assignGroupID`.

## License

MIT (see [LICENSE](LICENSE)).
