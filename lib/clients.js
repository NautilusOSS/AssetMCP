import algosdk from "algosdk";
import { getNetworkConfig } from "./networks.js";

/** @type {Map<string, { algod: import("algosdk").Algodv2, indexer: import("algosdk").Indexer }>} */
const cache = new Map();

/**
 * @param {string} networkId
 */
export function getClients(networkId) {
  let c = cache.get(networkId);
  if (c) return c;
  const cfg = getNetworkConfig(networkId);
  // Port 443 matches Nodely QuickStart (https://nodely.io/docs/free/start)
  const algod = new algosdk.Algodv2(cfg.algodToken, cfg.algodUrl, 443);
  const indexer = new algosdk.Indexer(cfg.indexerToken, cfg.indexerUrl, 443);
  c = { algod, indexer };
  cache.set(networkId, c);
  return c;
}
