/**
 * Smoke tests for XCHG-1 helpers (ABI shape + encoding). No live XCHG contract required.
 */
import assert from "node:assert/strict";
import algosdk from "algosdk";
import {
  ARC200_XCHG_ABI,
  ARC200_XCHG_INTERFACE_ID,
} from "../lib/arc200.js";

const iface = new algosdk.ABIContract(ARC200_XCHG_ABI);

const ex = iface.getMethodByName("arc200_exchange");
assert.equal(Buffer.from(ex.getSelector()).toString("hex").length, 8);

const redeem = iface.getMethodByName("arc200_redeem");
const amt = 1_000_000n;
const redeemArgs = [redeem.getSelector(), ...redeem.args.map((a, i) => a.type.encode([amt][i]))];
assert.equal(redeemArgs.length, 2);
assert.ok(redeemArgs[0] instanceof Uint8Array);
assert.ok(redeemArgs[1] instanceof Uint8Array);

const swap = iface.getMethodByName("arc200_swapBack");
const swapArgs = [swap.getSelector(), ...swap.args.map((a, i) => a.type.encode([amt][i]))];
assert.equal(swapArgs.length, 2);

assert.equal(ARC200_XCHG_INTERFACE_ID, "f7bde749");

console.log("arc200-xchg: OK");
