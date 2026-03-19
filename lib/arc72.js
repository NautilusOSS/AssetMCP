import algosdk from "algosdk";
import { arc72 as Arc72Contract } from "ulujs";
import { oneAddress } from "ulujs/impl/arc200/index.js";
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
 * @param {string} tokenId
 */
export function parseTokenId(tokenId) {
  try {
    return BigInt(tokenId);
  } catch {
    throw new AssetMcpError(
      ErrorCodes.MISSING_PARAM,
      `invalid tokenId: ${tokenId}`
    );
  }
}

/**
 * @param {string} networkId
 * @param {number} appId
 */
function arc72ReadOnly(networkId, appId) {
  const { algod, indexer } = getClients(networkId);
  return new Arc72Contract(appId, algod, indexer, {
    acc: { addr: oneAddress },
    simulate: true,
    formatBytes: true,
    waitForConfirmation: false,
  });
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} sender
 */
function arc72Sender(networkId, appId, sender) {
  assertAddress(sender);
  const { algod, indexer } = getClients(networkId);
  return new Arc72Contract(appId, algod, indexer, {
    acc: { addr: sender },
    simulate: true,
    formatBytes: true,
    waitForConfirmation: false,
  });
}

/**
 * @param {{ success: boolean, error?: unknown, txns?: string[] }} res
 */
function assertArc72Tx(res) {
  if (!res?.success) {
    throw new AssetMcpError(
      ErrorCodes.TX_BUILD_FAILED,
      "transaction build failed",
      res?.error
    );
  }
  const txns = res.txns;
  if (!Array.isArray(txns) || txns.length === 0) {
    throw new AssetMcpError(
      ErrorCodes.TX_BUILD_FAILED,
      "expected non-empty txns array from simulation"
    );
  }
  return txns;
}

/**
 * @param {{ success: boolean, returnValue?: unknown, error?: unknown }} res
 * @param {string} label
 */
function assertRead(res, label) {
  if (!res?.success) {
    throw new AssetMcpError(
      ErrorCodes.CONTRACT_CALL_FAILED,
      `${label} failed`,
      res?.error
    );
  }
  return res.returnValue;
}

/**
 * 4-byte interface id as hex (8 chars), e.g. ERC-721: 80ac58cd
 * @param {string} hex8
 */
export function parseInterfaceSelector(hex8) {
  const h = hex8.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{8}$/.test(h)) {
    throw new AssetMcpError(
      ErrorCodes.MISSING_PARAM,
      `interface_selector_hex must be 8 hex chars, got: ${hex8}`
    );
  }
  return new Uint8Array(Buffer.from(h, "hex"));
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} [tokenId]
 * @param {string} [interface_selector_hex]
 */
export async function arc72GetMetadata(
  networkId,
  appId,
  tokenId,
  interface_selector_hex
) {
  const c = arc72ReadOnly(networkId, appId);
  const totalSupply = assertRead(
    await c.arc72_totalSupply(),
    "arc72_totalSupply"
  );
  const out = { totalSupply };
  if (tokenId != null) {
    const tid = parseTokenId(tokenId);
    out.owner = assertRead(await c.arc72_ownerOf(tid), "arc72_ownerOf");
    out.tokenURI = assertRead(await c.arc72_tokenURI(tid), "arc72_tokenURI");
    out.approved = assertRead(
      await c.arc72_getApproved(tid),
      "arc72_getApproved"
    );
  }
  if (interface_selector_hex) {
    const sel = parseInterfaceSelector(interface_selector_hex);
    out.supportsInterface = assertRead(
      await c.supportsInterface(sel),
      "supportsInterface"
    );
  }
  return out;
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} tokenId
 */
export async function arc72OwnerOf(networkId, appId, tokenId) {
  const tid = parseTokenId(tokenId);
  const c = arc72ReadOnly(networkId, appId);
  return assertRead(await c.arc72_ownerOf(tid), "arc72_ownerOf");
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} address
 */
export async function arc72BalanceOf(networkId, appId, address) {
  assertAddress(address);
  const c = arc72ReadOnly(networkId, appId);
  return assertRead(await c.arc72_balanceOf(address), "arc72_balanceOf");
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} tokenId
 */
export async function arc72GetApproved(networkId, appId, tokenId) {
  const tid = parseTokenId(tokenId);
  const c = arc72ReadOnly(networkId, appId);
  return assertRead(await c.arc72_getApproved(tid), "arc72_getApproved");
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} owner
 * @param {string} operator
 */
export async function arc72IsApprovedForAll(
  networkId,
  appId,
  owner,
  operator
) {
  assertAddress(owner);
  assertAddress(operator);
  const c = arc72ReadOnly(networkId, appId);
  return assertRead(
    await c.arc72_isApprovedForAll(owner, operator),
    "arc72_isApprovedForAll"
  );
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} tokenId
 */
export async function arc72TokenUri(networkId, appId, tokenId) {
  const tid = parseTokenId(tokenId);
  const c = arc72ReadOnly(networkId, appId);
  return assertRead(await c.arc72_tokenURI(tid), "arc72_tokenURI");
}

/**
 * @param {string} networkId
 * @param {number} appId
 */
export async function arc72TotalSupply(networkId, appId) {
  const c = arc72ReadOnly(networkId, appId);
  return assertRead(await c.arc72_totalSupply(), "arc72_totalSupply");
}

/**
 * @param {Record<string, unknown>} q
 */
function toIndexerEventQuery(q) {
  const out = {};
  if (q.min_round != null) out.minRound = q.min_round;
  if (q.max_round != null) out.maxRound = q.max_round;
  if (q.address != null) out.sender = q.address;
  if (q.round != null) out.round = q.round;
  if (q.txid != null) out.txid = q.txid;
  if (q.limit != null) out.limit = q.limit;
  return out;
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {Record<string, unknown>} query
 */
export async function arc72GetEvents(networkId, appId, query = {}) {
  const c = arc72ReadOnly(networkId, appId);
  return c.getEvents(toIndexerEventQuery(query));
}

/**
 * ARC-72 transfer via arc72_transferFrom(from, to, tokenId). Caller (signer) must be owner or approved.
 * @param {string} networkId
 * @param {number} appId
 * @param {string} sender transaction sender (spender / operator)
 * @param {string} from current owner
 * @param {string} to recipient
 * @param {string} tokenId
 */
export async function arc72TransferTxn(
  networkId,
  appId,
  sender,
  from,
  to,
  tokenId
) {
  assertAddress(from);
  assertAddress(to);
  const tid = parseTokenId(tokenId);
  const c = arc72Sender(networkId, appId, sender);
  const res = await c.arc72_transferFrom(from, to, tid, true, false);
  return assertArc72Tx(res);
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} owner
 * @param {string} approved
 * @param {string} tokenId
 */
export async function arc72ApproveTxn(
  networkId,
  appId,
  owner,
  approved,
  tokenId
) {
  assertAddress(approved);
  const tid = parseTokenId(tokenId);
  const c = arc72Sender(networkId, appId, owner);
  const res = await c.arc72_approve(approved, tid, true, false);
  return assertArc72Tx(res);
}

/**
 * ulujs Arc72Contract.arc72_setApprovalForAll is currently broken (undefined vars).
 * Call arccjs contract instance directly with simulate:true (same as other writers).
 * @param {string} networkId
 * @param {number} appId
 * @param {string} owner
 * @param {string} operator
 * @param {boolean} approved
 */
export async function arc72SetApprovalForAllTxn(
  networkId,
  appId,
  owner,
  operator,
  approved
) {
  assertAddress(operator);
  const c = arc72Sender(networkId, appId, owner);
  const res = await c.contractInstance.arc72_setApprovalForAll(
    operator,
    approved
  );
  return assertArc72Tx(res);
}
