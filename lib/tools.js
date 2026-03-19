import { z } from "zod";
import { assertSupportedNetwork } from "./networks.js";
import { toolJson, okEnvelope, errEnvelope } from "./response.js";
import * as asa from "./asa.js";
import * as arc200 from "./arc200.js";
import * as arc72 from "./arc72.js";

const NetworkZ = z
  .enum(["algorand-mainnet", "voi-mainnet"])
  .describe("Algorand or Voi mainnet identifier.");

const AppIdZ = z
  .number()
  .int()
  .positive()
  .describe("Application ID of the ARC-200 or ARC-72 contract.");

const AssetIdZ = z
  .number()
  .int()
  .positive()
  .describe("ASA asset ID.");

const AddressZ = z
  .string()
  .min(1)
  .describe("58-character AVM account address.");

const AmountZ = z
  .string()
  .describe("Amount in base units (string) to avoid JS safe integer limits.");

const TokenIdZ = z
  .string()
  .describe("ARC-72 token id as decimal string (may exceed Number.MAX_SAFE_INTEGER).");

const NoteZ = z
  .string()
  .optional()
  .describe("Optional UTF-8 note field on the transaction.");

/**
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 */
export function registerAssetMcpTools(server) {
  /**
   * @template T
   * @param {z.ZodType<T>} schema
   * @param {(args: T) => Promise<unknown>} run
   * @param {(args: T, data: unknown) => Record<string, unknown>} meta
   */
  function reg(name, description, schema, run, meta) {
    server.tool(name, description, schema.shape, async (args) => {
      try {
        assertSupportedNetwork(args.network);
        const data = await run(args);
        return toolJson(okEnvelope(meta(args, data), data));
      } catch (e) {
        return toolJson(errEnvelope(e), true);
      }
    });
  }

  // ——— ASA ———
  reg(
    "asa_get_asset",
    "Load ASA configuration and on-chain parameters by asset ID (Algod).",
    z.object({
      network: NetworkZ,
      assetId: AssetIdZ,
    }),
    (a) => asa.asaGetAsset(a.network, a.assetId),
    (a, _d) => ({
      network: a.network,
      standard: "asa",
      method: "asa_get_asset",
      assetId: a.assetId,
    })
  );

  reg(
    "asa_get_holding",
    "Return one account's balance and frozen flag for an ASA (Algod account info).",
    z.object({
      network: NetworkZ,
      address: AddressZ.describe("Account to inspect."),
      assetId: AssetIdZ,
    }),
    (a) => asa.asaGetHolding(a.network, a.address, a.assetId),
    (a, _d) => ({
      network: a.network,
      standard: "asa",
      method: "asa_get_holding",
      assetId: a.assetId,
    })
  );

  reg(
    "asa_search_holdings",
    "List ASA holdings for an account via Indexer (paginated). Optional assetId filter.",
    z.object({
      network: NetworkZ,
      address: AddressZ.describe("Account to list holdings for."),
      assetId: AssetIdZ.optional().describe("If set, only this ASA."),
      limit: z.number().int().min(1).max(1000).optional(),
      nextToken: z
        .string()
        .optional()
        .describe("Indexer next-token from a previous page."),
    }),
    (a) =>
      asa.asaSearchHoldings(
        a.network,
        a.address,
        a.assetId,
        a.limit,
        a.nextToken
      ),
    (a, d) => ({
      network: a.network,
      standard: "asa",
      method: "asa_search_holdings",
    })
  );

  reg(
    "asa_transfer_txn",
    "Build an unsigned ASA transfer (axfer). Amount is in base units. Optional closeRemainderTo closes the sender holding after transfer.",
    z.object({
      network: NetworkZ,
      sender: AddressZ,
      receiver: AddressZ,
      assetId: AssetIdZ,
      amount: AmountZ,
      note: NoteZ,
      closeRemainderTo: AddressZ.optional().describe(
        "If set, close sender ASA balance to this address after sending amount."
      ),
    }),
    (a) =>
      asa.asaTransferTxn(
        a.network,
        a.sender,
        a.receiver,
        a.assetId,
        a.amount,
        a.note,
        a.closeRemainderTo
      ),
    (a, d) => ({
      network: a.network,
      standard: "asa",
      method: "asa_transfer_txn",
      assetId: a.assetId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  reg(
    "asa_optin_txn",
    "Build an unsigned ASA opt-in (0-amount self transfer).",
    z.object({
      network: NetworkZ,
      sender: AddressZ.describe("Account opting in (receiver = sender)."),
      assetId: AssetIdZ,
      note: NoteZ,
    }),
    (a) => asa.asaOptInTxn(a.network, a.sender, a.assetId, a.note),
    (a, d) => ({
      network: a.network,
      standard: "asa",
      method: "asa_optin_txn",
      assetId: a.assetId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  reg(
    "asa_closeout_txn",
    "Build an unsigned ASA transfer that closes the sender's holding (set closeRemainderTo). Supply full balance as amount.",
    z.object({
      network: NetworkZ,
      sender: AddressZ,
      assetId: AssetIdZ,
      receiver: AddressZ.describe("Receives the ASA amount."),
      amount: AmountZ.describe("Whole balance to move in base units."),
      closeTo: AddressZ.describe(
        "Close-to address (often same as receiver for a full close)."
      ),
      note: NoteZ,
    }),
    (a) =>
      asa.asaCloseOutTxn(
        a.network,
        a.sender,
        a.assetId,
        a.receiver,
        a.amount,
        a.closeTo,
        a.note
      ),
    (a, d) => ({
      network: a.network,
      standard: "asa",
      method: "asa_closeout_txn",
      assetId: a.assetId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  // ——— ARC-200 ———
  reg(
    "arc200_get_metadata",
    "Read ARC-200 name, symbol, decimals, and totalSupply (ulujs + simulation).",
    z.object({ network: NetworkZ, appId: AppIdZ }),
    (a) => arc200.arc200GetMetadata(a.network, a.appId),
    (a, _d) => ({
      network: a.network,
      standard: "arc200",
      method: "arc200_get_metadata",
      appId: a.appId,
    })
  );

  reg(
    "arc200_balance_of",
    "ARC-200 balanceOf(address) as base units (string in response).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      address: AddressZ.describe("Token holder."),
    }),
    (a) => arc200.arc200BalanceOf(a.network, a.appId, a.address),
    (a, _d) => ({
      network: a.network,
      standard: "arc200",
      method: "arc200_balance_of",
      appId: a.appId,
    })
  );

  reg(
    "arc200_allowance",
    "ARC-200 allowance(owner, spender) in base units.",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      owner: AddressZ,
      spender: AddressZ,
    }),
    (a) => arc200.arc200Allowance(a.network, a.appId, a.owner, a.spender),
    (a, _d) => ({
      network: a.network,
      standard: "arc200",
      method: "arc200_allowance",
      appId: a.appId,
    })
  );

  reg(
    "arc200_has_balance",
    "ARC-200 hasBalance(address) — whether the account has a non-zero balance box (ulujs dual-schema read).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      address: AddressZ,
    }),
    (a) => arc200.arc200HasBalance(a.network, a.appId, a.address),
    (a, _d) => ({
      network: a.network,
      standard: "arc200",
      method: "arc200_has_balance",
      appId: a.appId,
    })
  );

  reg(
    "arc200_has_allowance",
    "ARC-200 hasAllowance(owner, spender) — allowance box present / non-zero (ulujs dual-schema read).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      owner: AddressZ,
      spender: AddressZ,
    }),
    (a) => arc200.arc200HasAllowance(a.network, a.appId, a.owner, a.spender),
    (a, _d) => ({
      network: a.network,
      standard: "arc200",
      method: "arc200_has_allowance",
      appId: a.appId,
    })
  );

  const EventFilterFields = {
    minRound: z
      .number()
      .int()
      .optional()
      .describe("Minimum round (inclusive) for indexer log scan."),
    maxRound: z
      .number()
      .int()
      .optional()
      .describe("Maximum round (inclusive) for indexer log scan."),
    address: z
      .string()
      .optional()
      .describe("Filter by log sender address (passed to indexer as sender)."),
    round: z.number().int().optional().describe("Exact round filter."),
    txid: z.string().optional().describe("Filter by transaction id."),
    limit: z.number().int().optional().describe("Indexer page size hint."),
  };

  reg(
    "arc200_get_events",
    "Fetch ARC-200 contract events (Transfer + Approval) via indexer (ulujs getEvents).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      ...EventFilterFields,
    }),
    (a) =>
      arc200.arc200GetEvents(a.network, a.appId, {
        min_round: a.minRound,
        max_round: a.maxRound,
        address: a.address,
        round: a.round,
        txid: a.txid,
        limit: a.limit,
      }),
    (a, _d) => ({
      network: a.network,
      standard: "arc200",
      method: "arc200_get_events",
      appId: a.appId,
    })
  );

  reg(
    "arc200_transfer_txn",
    "Simulate ARC-200 transfer and return unsigned txn group as base64 strings (sign with UluWalletMCP).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      sender: AddressZ.describe("From address (must sign the group)."),
      receiver: AddressZ,
      amount: AmountZ,
    }),
    (a) =>
      arc200.arc200TransferTxn(
        a.network,
        a.appId,
        a.sender,
        a.receiver,
        a.amount
      ).then((txns) => ({ transactions: txns })),
    (a, d) => ({
      network: a.network,
      standard: "arc200",
      method: "arc200_transfer_txn",
      appId: a.appId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  reg(
    "arc200_transfer_from_txn",
    "Simulate ARC-200 transferFrom(spender, from, to, amount); spender signs.",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      spender: AddressZ.describe("Caller that spends allowance."),
      from: AddressZ,
      to: AddressZ,
      amount: AmountZ,
    }),
    (a) =>
      arc200.arc200TransferFromTxn(
        a.network,
        a.appId,
        a.spender,
        a.from,
        a.to,
        a.amount
      ).then((txns) => ({ transactions: txns })),
    (a, d) => ({
      network: a.network,
      standard: "arc200",
      method: "arc200_transfer_from_txn",
      appId: a.appId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  reg(
    "arc200_approve_txn",
    "Simulate ARC-200 approve(spender, amount); owner signs.",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      owner: AddressZ,
      spender: AddressZ,
      amount: AmountZ,
    }),
    (a) =>
      arc200.arc200ApproveTxn(
        a.network,
        a.appId,
        a.owner,
        a.spender,
        a.amount
      ).then((txns) => ({ transactions: txns })),
    (a, d) => ({
      network: a.network,
      standard: "arc200",
      method: "arc200_approve_txn",
      appId: a.appId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  reg(
    "nt200_withdraw_txn",
    "Build unsigned NT200 withdraw(amount) txn. Withdraws ARC-200 wrapped network tokens or ASAs; token holder must be opted in to the underlying asset. One txn (ulujs CONTRACT + abi.nt200).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      sender: AddressZ.describe("Address that holds the ARC-200 and will receive the underlying."),
      amount: AmountZ.describe("Amount to unwrap in base units (string)."),
    }),
    (a) =>
      arc200.arc200WithdrawTxn(
        a.network,
        a.appId,
        a.sender,
        a.amount
      ).then((txns) => ({ transactions: txns })),
    (a, d) => ({
      network: a.network,
      standard: "arc200",
      method: "nt200_withdraw_txn",
      appId: a.appId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  reg(
    "nt200_deposit_txn",
    "Build unsigned NT200 deposit(amount) txn(s). Deposit network token (payment) or ASA (axfer) preceding app call. For network: payment + app call; for ASA: set assetId for axfer + app call. Uses ulujs CONTRACT + abi.nt200.",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      sender: AddressZ.describe("Depositor (must hold network token or ASA)."),
      amount: AmountZ.describe("Amount to deposit in base units (string)."),
      assetId: AssetIdZ.optional().describe(
        "If set, deposit ASA (axfer then app call); omit for network token (payment then app call)."
      ),
    }),
    (a) =>
      arc200
        .arc200DepositTxn(a.network, a.appId, a.sender, a.amount, {
          assetId: a.assetId,
        })
        .then((txns) => ({ transactions: txns })),
    (a, d) => ({
      network: a.network,
      standard: "arc200",
      method: "nt200_deposit_txn",
      appId: a.appId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  reg(
    "nt200_create_balance_box_txn",
    "Build unsigned NT200 createBalanceBox(address) txn(s). Creates a balance box for the specified address if it doesn't exist. May include payment txn for box creation cost. Uses ulujs CONTRACT + abi.nt200.",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      sender: AddressZ.describe("Transaction sender (pays for box creation if needed)."),
      address: AddressZ.describe("Address for whom to create the balance box."),
    }),
    (a) =>
      arc200
        .arc200CreateBalanceBoxTxn(a.network, a.appId, a.sender, a.address)
        .then((txns) => ({ transactions: txns })),
    (a, d) => ({
      network: a.network,
      standard: "arc200",
      method: "nt200_create_balance_box_txn",
      appId: a.appId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  // ——— ARC-72 ———
  reg(
    "arc72_get_metadata",
    "Aggregate ARC-72 facts: totalSupply; if tokenId set, owner, tokenURI, approved; optional supportsInterface (8-hex selector).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      tokenId: TokenIdZ.optional(),
      interfaceSelectorHex: z
        .string()
        .optional()
        .describe(
          "4-byte interface id as 8 hex chars (e.g. ERC-721 80ac58cd)."
        ),
    }),
    (a) =>
      arc72.arc72GetMetadata(
        a.network,
        a.appId,
        a.tokenId,
        a.interfaceSelectorHex
      ),
    (a, _d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_get_metadata",
      appId: a.appId,
    })
  );

  reg(
    "arc72_owner_of",
    "ARC-72 ownerOf(tokenId).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      tokenId: TokenIdZ,
    }),
    (a) => arc72.arc72OwnerOf(a.network, a.appId, a.tokenId),
    (a, _d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_owner_of",
      appId: a.appId,
    })
  );

  reg(
    "arc72_balance_of",
    "ARC-72 balanceOf(address) — number of NFTs owned.",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      address: AddressZ,
    }),
    (a) => arc72.arc72BalanceOf(a.network, a.appId, a.address),
    (a, _d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_balance_of",
      appId: a.appId,
    })
  );

  reg(
    "arc72_get_approved",
    "ARC-72 getApproved(tokenId).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      tokenId: TokenIdZ,
    }),
    (a) => arc72.arc72GetApproved(a.network, a.appId, a.tokenId),
    (a, _d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_get_approved",
      appId: a.appId,
    })
  );

  reg(
    "arc72_is_approved_for_all",
    "ARC-72 isApprovedForAll(owner, operator).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      owner: AddressZ,
      operator: AddressZ,
    }),
    (a) =>
      arc72.arc72IsApprovedForAll(a.network, a.appId, a.owner, a.operator),
    (a, _d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_is_approved_for_all",
      appId: a.appId,
    })
  );

  reg(
    "arc72_token_uri",
    "ARC-72 tokenURI(tokenId) as UTF-8 string (null bytes stripped by ulujs).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      tokenId: TokenIdZ,
    }),
    (a) => arc72.arc72TokenUri(a.network, a.appId, a.tokenId),
    (a, _d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_token_uri",
      appId: a.appId,
    })
  );

  reg(
    "arc72_total_supply",
    "ARC-72 totalSupply().",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
    }),
    (a) => arc72.arc72TotalSupply(a.network, a.appId),
    (a, _d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_total_supply",
      appId: a.appId,
    })
  );

  reg(
    "arc72_get_events",
    "Fetch ARC-72 Transfer, Approval, ApprovalForAll events (ulujs getEvents).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      ...EventFilterFields,
    }),
    (a) =>
      arc72.arc72GetEvents(a.network, a.appId, {
        min_round: a.minRound,
        max_round: a.maxRound,
        address: a.address,
        round: a.round,
        txid: a.txid,
        limit: a.limit,
      }),
    (a, _d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_get_events",
      appId: a.appId,
    })
  );

  reg(
    "arc72_transfer_txn",
    "Simulate ARC-72 transferFrom(from, to, tokenId). Signer is sender (owner or approved operator).",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      sender: AddressZ.describe("Transaction sender (must be authorized)."),
      from: AddressZ.describe("Current owner address."),
      to: AddressZ,
      tokenId: TokenIdZ,
    }),
    (a) =>
      arc72
        .arc72TransferTxn(
          a.network,
          a.appId,
          a.sender,
          a.from,
          a.to,
          a.tokenId
        )
        .then((txns) => ({ transactions: txns })),
    (a, d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_transfer_txn",
      appId: a.appId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  reg(
    "arc72_approve_txn",
    "Simulate ARC-72 approve(approved, tokenId); owner signs.",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      owner: AddressZ,
      approved: AddressZ.describe("Spender / operator to approve for this token."),
      tokenId: TokenIdZ,
    }),
    (a) =>
      arc72
        .arc72ApproveTxn(
          a.network,
          a.appId,
          a.owner,
          a.approved,
          a.tokenId
        )
        .then((txns) => ({ transactions: txns })),
    (a, d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_approve_txn",
      appId: a.appId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );

  reg(
    "arc72_set_approval_for_all_txn",
    "Simulate ARC-72 setApprovalForAll(operator, approved). Uses arccjs directly (ulujs wrapper is broken). Owner signs.",
    z.object({
      network: NetworkZ,
      appId: AppIdZ,
      owner: AddressZ,
      operator: AddressZ,
      approved: z.boolean().describe("True to enable operator for all tokens."),
    }),
    (a) =>
      arc72
        .arc72SetApprovalForAllTxn(
          a.network,
          a.appId,
          a.owner,
          a.operator,
          a.approved
        )
        .then((txns) => ({ transactions: txns })),
    (a, d) => ({
      network: a.network,
      standard: "arc72",
      method: "arc72_set_approval_for_all_txn",
      appId: a.appId,
      txCount: /** @type {{transactions:string[]}} */ (d).transactions.length,
    })
  );
}
