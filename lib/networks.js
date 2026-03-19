/**
 * Network identifiers and resolved RPC configuration (Algod + Indexer).
 */
import { AssetMcpError, ErrorCodes } from "./errors.js";

/** @typedef {{ id: string, chain: string, algodUrl: string, algodToken: string, indexerUrl: string, indexerToken: string }} NetworkConfig */

/** Defaults: Nodely free tier — https://nodely.io/docs/free/start */
const DEFAULTS = {
  "algorand-mainnet": {
    chain: "algorand",
    algodUrl: "https://mainnet-api.4160.nodely.dev",
    algodToken: "",
    indexerUrl: "https://mainnet-idx.4160.nodely.dev",
    indexerToken: "",
  },
  "voi-mainnet": {
    chain: "voi",
    algodUrl: "https://mainnet-api.voi.nodely.dev",
    algodToken: "",
    indexerUrl: "https://mainnet-idx.voi.nodely.dev",
    indexerToken: "",
  },
};

/**
 * Env key: ASSET_MCP_ALGORAND_MAINNET_ALGOD_URL, etc.
 * @param {string} networkId
 * @param {string} suffix ALGOD_URL | ALGOD_TOKEN | INDEXER_URL | INDEXER_TOKEN
 */
function envKey(networkId, suffix) {
  const u = networkId.toUpperCase().replace(/-/g, "_");
  return `ASSET_MCP_${u}_${suffix}`;
}

/**
 * @param {string} networkId
 * @returns {NetworkConfig}
 */
export function getNetworkConfig(networkId) {
  const base = DEFAULTS[networkId];
  if (!base) {
    throw new Error(`unsupported network: ${networkId}`);
  }
  const pick = (suffix, fallback) =>
    process.env[envKey(networkId, suffix)]?.trim() || fallback;

  return {
    id: networkId,
    chain: base.chain,
    algodUrl: pick("ALGOD_URL", base.algodUrl),
    algodToken: pick("ALGOD_TOKEN", base.algodToken),
    indexerUrl: pick("INDEXER_URL", base.indexerUrl),
    indexerToken: pick("INDEXER_TOKEN", base.indexerToken),
  };
}

export const SUPPORTED_NETWORKS = Object.freeze(Object.keys(DEFAULTS));

export function assertSupportedNetwork(networkId) {
  if (!DEFAULTS[networkId]) {
    throw new AssetMcpError(
      ErrorCodes.UNSUPPORTED_NETWORK,
      `unsupported network: ${networkId}. Expected one of: ${SUPPORTED_NETWORKS.join(", ")}`
    );
  }
}
