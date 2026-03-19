import algosdk from "algosdk";
import { getClients } from "./clients.js";
import { AssetMcpError, ErrorCodes } from "./errors.js";

/**
 * @param {string} addr
 */
function assertAddress(addr) {
  if (!addr || !algosdk.isValidAddress(addr)) {
    throw new AssetMcpError(
      ErrorCodes.MALFORMED_ADDRESS,
      `malformed address: ${addr}`
    );
  }
}

/**
 * @param {string} networkId
 * @param {number} assetId
 */
export async function asaGetAsset(networkId, assetId) {
  const { algod } = getClients(networkId);
  try {
    const asset = await algod.getAssetByID(assetId).do();
    return asset;
  } catch (e) {
    throw new AssetMcpError(
      ErrorCodes.CONTRACT_CALL_FAILED,
      `failed to load ASA ${assetId}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * @param {string} networkId
 * @param {string} address
 * @param {number} assetId
 */
export async function asaGetHolding(networkId, address, assetId) {
  assertAddress(address);
  const { algod } = getClients(networkId);
  try {
    const info = await algod.accountInformation(address).do();
    const assets = info.assets ?? [];
    const row = assets.find((a) => Number(a["asset-id"]) === assetId);
    if (!row) {
      return { optedIn: false, assetId, amount: "0", frozen: false };
    }
    return {
      optedIn: true,
      assetId,
      amount: String(row.amount),
      frozen: Boolean(row["is-frozen"]),
    };
  } catch (e) {
    throw new AssetMcpError(
      ErrorCodes.CONTRACT_CALL_FAILED,
      `failed to load account holding: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * @param {string} networkId
 * @param {string} address
 * @param {number} [assetId]
 * @param {number} [limit]
 * @param {string} [nextToken]
 */
export async function asaSearchHoldings(
  networkId,
  address,
  assetId,
  limit,
  nextToken
) {
  assertAddress(address);
  const { indexer } = getClients(networkId);
  try {
    let req = indexer.lookupAccountAssets(address);
    if (assetId != null) req = req.assetId(assetId);
    if (limit != null) req = req.limit(limit);
    if (nextToken) req = req.nextToken(nextToken);
    const res = await req.do();
    return {
      holdings: res.assets ?? [],
      nextToken: res["next-token"] ?? null,
    };
  } catch (e) {
    throw new AssetMcpError(
      ErrorCodes.INDEXER_FAILED,
      `indexer account assets query failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * @param {object} p
 */
async function suggestedParams(networkId) {
  const { algod } = getClients(networkId);
  return algod.getTransactionParams().do();
}

/**
 * @param {string} networkId
 * @param {string} sender
 * @param {string} receiver
 * @param {number} assetId
 * @param {string} amount base units (string for large ints)
 * @param {string} [note]
 * @param {string} [closeRemainderTo] if set, close sender's holding after transfer
 */
export async function asaTransferTxn(
  networkId,
  sender,
  receiver,
  assetId,
  amount,
  note,
  closeRemainderTo
) {
  assertAddress(sender);
  assertAddress(receiver);
  if (closeRemainderTo) assertAddress(closeRemainderTo);
  let amt;
  try {
    amt = BigInt(amount);
  } catch {
    throw new AssetMcpError(
      ErrorCodes.MISSING_PARAM,
      `invalid amount: ${amount}`
    );
  }
  try {
    const sp = await suggestedParams(networkId);
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender,
      receiver,
      suggestedParams: sp,
      assetIndex: assetId,
      amount: amt,
      note: note !== undefined ? new Uint8Array(Buffer.from(note, "utf8")) : undefined,
      closeRemainderTo: closeRemainderTo || undefined,
    });
    const b64 = Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString(
      "base64"
    );
    return { transactions: [b64] };
  } catch (e) {
    throw new AssetMcpError(
      ErrorCodes.TX_BUILD_FAILED,
      `ASA transfer build failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * @param {string} networkId
 * @param {string} sender
 * @param {number} assetId
 * @param {string} [note]
 */
export async function asaOptInTxn(networkId, sender, assetId, note) {
  return asaTransferTxn(networkId, sender, sender, assetId, "0", note, undefined);
}

/**
 * Close ASA holding: transfer `amount` (full balance) to receiver and set closeRemainderTo.
 * @param {string} networkId
 * @param {string} sender
 * @param {number} assetId
 * @param {string} receiver
 * @param {string} amount base units to send (typically full balance)
 * @param {string} closeTo account that receives residual / closes the holding
 * @param {string} [note]
 */
export async function asaCloseOutTxn(
  networkId,
  sender,
  assetId,
  receiver,
  amount,
  closeTo,
  note
) {
  assertAddress(receiver);
  assertAddress(closeTo);
  return asaTransferTxn(
    networkId,
    sender,
    receiver,
    assetId,
    amount,
    note,
    closeTo
  );
}
