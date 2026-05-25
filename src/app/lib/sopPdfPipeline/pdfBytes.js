/**
 * pdf.js requires a plain Uint8Array — Node Buffer is a Uint8Array subclass and is rejected.
 * @param {Buffer|Uint8Array|ArrayBuffer|ArrayLike<number>} input
 */
export function toPdfUint8Array(input) {
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  if (ArrayBuffer.isView(input)) {
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
      return Uint8Array.from(input);
    }
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  return new Uint8Array(input);
}
