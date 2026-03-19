import algosdk from "algosdk";
import ulujs, { CONTRACT as ArccjsContract } from "ulujs";
import { arc200 as Arc200Contract } from "ulujs";
import { oneAddress, BalanceBoxCost } from "ulujs/impl/arc200/index.js";
import { getClients } from "./clients.js";
import { AssetMcpError, ErrorCodes } from "./errors.js";
import { stripTrailingZeroBytes } from "./strings.js";

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
 * Read-only ARC-200 client (simulation sender = public placeholder).
 * @param {string} networkId
 * @param {number} appId
 */
function arc200ReadOnly(networkId, appId) {
  const { algod, indexer } = getClients(networkId);
  return new Arc200Contract(appId, algod, indexer, {
    acc: { addr: oneAddress },
    simulate: true,
    formatBytes: true,
    waitForConfirmation: false,
  });
}

/**
 * ARC-200 client for unsigned txn simulation with a real sender address.
 * @param {string} networkId
 * @param {number} appId
 * @param {string} sender
 */
function arc200Sender(networkId, appId, sender) {
  assertAddress(sender);
  const { algod, indexer } = getClients(networkId);
  return new Arc200Contract(appId, algod, indexer, {
    acc: { addr: sender },
    simulate: true,
    formatBytes: true,
    waitForConfirmation: false,
  });
}

/**
 * @param {{ success: boolean, error?: unknown, txns?: string[] }} res
 */
function assertArc200Tx(res) {
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
 * @param {string} s
 */
export function parseUintString(s) {
  try {
    const v = BigInt(s);
    if (v < 0n) throw new Error("negative");
    return v;
  } catch {
    throw new AssetMcpError(
      ErrorCodes.MISSING_PARAM,
      `invalid uint string: ${s}`
    );
  }
}

/**
 * @param {string} networkId
 * @param {number} appId
 */
export async function arc200GetMetadata(networkId, appId) {
  const c = arc200ReadOnly(networkId, appId);
  const meta = await c.getMetadata();
  assertRead(meta, "getMetadata");
  const v = meta.returnValue;
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    const o = /** @type {Record<string, unknown>} */ (v);
    return {
      ...o,
      name: stripTrailingZeroBytes(o.name),
      symbol: stripTrailingZeroBytes(o.symbol),
    };
  }
  return v;
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} address
 */
export async function arc200BalanceOf(networkId, appId, address) {
  assertAddress(address);
  const c = arc200ReadOnly(networkId, appId);
  const res = await c.arc200_balanceOf(address);
  return assertRead(res, "arc200_balanceOf");
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} owner
 * @param {string} spender
 */
export async function arc200Allowance(networkId, appId, owner, spender) {
  assertAddress(owner);
  assertAddress(spender);
  const c = arc200ReadOnly(networkId, appId);
  const res = await c.arc200_allowance(owner, spender);
  return assertRead(res, "arc200_allowance");
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} address
 */
export async function arc200HasBalance(networkId, appId, address) {
  assertAddress(address);
  const c = arc200ReadOnly(networkId, appId);
  const res = await c.hasBalance(address);
  assertRead(res, "hasBalance");
  return Boolean(res.returnValue);
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} owner
 * @param {string} spender
 */
export async function arc200HasAllowance(networkId, appId, owner, spender) {
  assertAddress(owner);
  assertAddress(spender);
  const c = arc200ReadOnly(networkId, appId);
  const res = await c.hasAllowance(owner, spender);
  assertRead(res, "hasAllowance");
  return Boolean(res.returnValue);
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
export async function arc200GetEvents(networkId, appId, query = {}) {
  const c = arc200ReadOnly(networkId, appId);
  const q = toIndexerEventQuery(query);
  return c.getEvents(q);
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} sender
 * @param {string} receiver
 * @param {string} amount
 */
export async function arc200TransferTxn(
  networkId,
  appId,
  sender,
  receiver,
  amount
) {
  assertAddress(receiver);
  const amt = parseUintString(amount);
  const c = arc200Sender(networkId, appId, sender);
  const res = await c.arc200_transfer(receiver, amt, true, false);
  return assertArc200Tx(res);
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} spender
 * @param {string} from
 * @param {string} to
 * @param {string} amount
 */
export async function arc200TransferFromTxn(
  networkId,
  appId,
  spender,
  from,
  to,
  amount
) {
  assertAddress(from);
  assertAddress(to);
  const amt = parseUintString(amount);
  const c = arc200Sender(networkId, appId, spender);
  const res = await c.arc200_transferFrom(from, to, amt, true, false);
  return assertArc200Tx(res);
}

/**
 * @param {string} networkId
 * @param {number} appId
 * @param {string} owner
 * @param {string} spender
 * @param {string} amount
 */
export async function arc200ApproveTxn(
  networkId,
  appId,
  owner,
  spender,
  amount
) {
  assertAddress(spender);
  const amt = parseUintString(amount);
  const c = arc200Sender(networkId, appId, owner);
  const res = await c.arc200_approve(spender, amt, true, false);
  return assertArc200Tx(res);
}

/**
 * Build unsigned txns for NT200 withdraw (same ABI method: withdraw(uint64)).
 * Uses ulujs CONTRACT + abi.nt200 with simulation so the withdraw txn includes box refs.
 * Only the withdraw call is built (one txn). The token holder must be opted in to the
 * underlying ASA to receive the unwrapped asset.
 *
 * @param {string} networkId
 * @param {number} appId
 * @param {string} sender Token holder (must be opted in to underlying ASA)
 * @param {string} amount Base units (string)
 * @returns {Promise<string[]>} Withdraw txn(s) as base64
 */
export async function arc200WithdrawTxn(networkId, appId, sender, amount) {
  assertAddress(sender);
  const amt = parseUintString(amount);
  const { algod, indexer } = getClients(networkId);

  const ci = new ArccjsContract(
    appId,
    algod,
    indexer,
    ulujs.abi.nt200,
    { addr: sender },
    true,  // simulate
    false, // waitForConfirmation
    false  // objectOnly — false so we get full txns with boxes
  );
  ci.setFee(2000);
  const withdrawRes = await ci.withdraw(amt);
  if (!withdrawRes?.success || !Array.isArray(withdrawRes.txns) || withdrawRes.txns.length === 0) {
    throw new AssetMcpError(
      ErrorCodes.TX_BUILD_FAILED,
      "withdraw build failed (contract may not support NT200 withdraw)",
      withdrawRes?.error
    );
  }

  const txObjs = withdrawRes.txns.map((b64) =>
    algosdk.decodeUnsignedTransaction(Buffer.from(b64, "base64"))
  );
  const group = algosdk.assignGroupID(txObjs);
  return group.map((txn) =>
    Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64")
  );
}

/**
 * Build unsigned txns for NT200 deposit (same ABI method: deposit(uint64)).
 * Uses ulujs CONTRACT + abi.nt200 with simulation. For network tokens: payment txn
 * (with optional box-cost) precedes the app call. For ASA: optional assetId adds an
 * axfer (sender → app) before the app call. Token holder must have sufficient balance.
 *
 * @param {string} networkId
 * @param {number} appId
 * @param {string} sender Depositor (must hold network token or ASA)
 * @param {string} amount Base units (string)
 * @param {{ assetId?: number }} [opts] If assetId set, deposit ASA (axfer then app call); else deposit network token (payment then app call).
 * @returns {Promise<string[]>} Deposit txn(s) as base64
 */
export async function arc200DepositTxn(networkId, appId, sender, amount, opts = {}) {
  assertAddress(sender);
  const amt = parseUintString(amount);
  const { algod, indexer } = getClients(networkId);
  const appAddress = algosdk.getApplicationAddress(appId);

  const ci = new ArccjsContract(
    appId,
    algod,
    indexer,
    ulujs.abi.nt200,
    { addr: sender },
    true,
    false,
    false
  );
  ci.setFee(2000);

  if (opts.assetId != null) {
    const assetId = Number(opts.assetId);
    if (!Number.isInteger(assetId) || assetId < 0) {
      throw new AssetMcpError(
        ErrorCodes.MISSING_PARAM,
        `invalid assetId: ${opts.assetId}`
      );
    }
    ci.setExtraTxns([
      {
        xaid: assetId,
        snd: sender,
        arcv: appAddress.toString?.() ?? appAddress,
        xamt: amt,
      },
    ]);
  } else {
    const balRes = await arc200BalanceOf(networkId, appId, sender);
    const bal = BigInt(String(balRes ?? "0"));
    const boxCost = bal === 0n ? BigInt(BalanceBoxCost) : 0n;
    ci.setPaymentAmount(boxCost + amt);
  }

  const depositRes = await ci.deposit(amt);
  if (!depositRes?.success || !Array.isArray(depositRes.txns) || depositRes.txns.length === 0) {
    throw new AssetMcpError(
      ErrorCodes.TX_BUILD_FAILED,
      "deposit build failed (contract may not support NT200 deposit)",
      depositRes?.error
    );
  }

  const txObjs = depositRes.txns.map((b64) =>
    algosdk.decodeUnsignedTransaction(Buffer.from(b64, "base64"))
  );
  const group = algosdk.assignGroupID(txObjs);
  return group.map((txn) =>
    Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64")
  );
}

/**
 * Build unsigned txns for NT200 createBalanceBox(address).
 * Uses ulujs CONTRACT + abi.nt200 with simulation. Creates a balance box for the
 * specified address if it doesn't exist. May include a payment txn for box creation cost.
 *
 * @param {string} networkId
 * @param {number} appId
 * @param {string} sender Transaction sender (pays for box creation if needed)
 * @param {string} address Address for whom to create the balance box
 * @returns {Promise<string[]>} CreateBalanceBox txn(s) as base64
 */
export async function arc200CreateBalanceBoxTxn(networkId, appId, sender, address) {
  assertAddress(sender);
  assertAddress(address);
  const { algod, indexer } = getClients(networkId);

  const ci = new ArccjsContract(
    appId,
    algod,
    indexer,
    ulujs.abi.nt200,
    { addr: sender },
    true,
    false,
    false
  );
  ci.setFee(2000);

  const balRes = await arc200BalanceOf(networkId, appId, address);
  const bal = BigInt(String(balRes ?? "0"));
  const boxCost = bal === 0n ? BigInt(BalanceBoxCost) : 0n;
  if (boxCost > 0n) {
    ci.setPaymentAmount(boxCost);
  }

  const createBoxRes = await ci.createBalanceBox(address);
  if (!createBoxRes?.success || !Array.isArray(createBoxRes.txns) || createBoxRes.txns.length === 0) {
    throw new AssetMcpError(
      ErrorCodes.TX_BUILD_FAILED,
      "createBalanceBox build failed (contract may not support NT200 createBalanceBox)",
      createBoxRes?.error
    );
  }

  const txObjs = createBoxRes.txns.map((b64) =>
    algosdk.decodeUnsignedTransaction(Buffer.from(b64, "base64"))
  );
  const group = algosdk.assignGroupID(txObjs);
  return group.map((txn) =>
    Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64")
  );
}
