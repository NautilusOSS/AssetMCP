/**
 * Remove trailing NUL (0x00) bytes from fixed-width on-chain string fields.
 * @param {unknown} value
 * @returns {unknown}
 */
export function stripTrailingZeroBytes(value) {
  if (typeof value !== "string") return value;
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 0) end -= 1;
  return end === value.length ? value : value.slice(0, end);
}
