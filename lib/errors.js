/**
 * Application-level errors surfaced as JSON in tool responses.
 */
export const ErrorCodes = {
  UNSUPPORTED_NETWORK: "unsupported_network",
  MISSING_PARAM: "missing_param",
  MALFORMED_ADDRESS: "malformed_address",
  CONTRACT_CALL_FAILED: "contract_call_failed",
  TX_BUILD_FAILED: "transaction_build_failed",
  INDEXER_FAILED: "indexer_failed",
};

export class AssetMcpError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {unknown} [details]
   */
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "AssetMcpError";
    this.code = code;
    this.details = details;
  }
}
