import { normalize } from "./normalize.js";
import { AssetMcpError } from "./errors.js";

/**
 * @param {unknown} payload
 * @param {boolean} [isError]
 */
export function toolJson(payload, isError = false) {
  const text = JSON.stringify(normalize(payload), null, 2);
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  };
}

/**
 * @param {object} meta
 * @param {unknown} data
 */
export function okEnvelope(meta, data) {
  return {
    ok: true,
    ...meta,
    data,
  };
}

/**
 * @param {unknown} err
 */
export function errEnvelope(err) {
  if (err instanceof AssetMcpError) {
    return {
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: normalize(err.details) } : {}),
      },
    };
  }
  return {
    ok: false,
    error: {
      code: "internal_error",
      message: err instanceof Error ? err.message : String(err),
    },
  };
}
